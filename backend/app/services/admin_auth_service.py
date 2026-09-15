from datetime import datetime, timedelta
import hashlib
import secrets
from sqlalchemy.orm import Session

from .. import config
from ..models import AdminAccount, AdminOtpRequest, AdminSession
from ..schema_migrate import get_setting_value
from .otp_service import (
    OTPProviderError,
    generate_otp_code,
    generate_salt,
    get_otp_provider,
    hash_otp,
    otp_matches,
)
from .audit_service import write_audit


class AdminAuthError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _hash_token(token: str) -> str:
    material = f"{token}:{config.ADMIN_SESSION_PEPPER}".encode("utf-8")
    return hashlib.sha256(material).hexdigest()


def _otp_expiry_seconds(db: Session) -> int:
    return int(get_setting_value(db, "otp_expiry_seconds", str(config.OTP_EXPIRY_SECONDS)))


def _otp_max_attempts(db: Session) -> int:
    return int(get_setting_value(db, "otp_max_attempts", str(config.OTP_MAX_ATTEMPTS)))


def _session_timeout_seconds(db: Session) -> int:
    return int(get_setting_value(db, "session_timeout_seconds", str(config.ADMIN_SESSION_TIMEOUT_SECONDS)))


def send_admin_otp(db: Session, admin_user_id: str) -> dict:
    admin = db.query(AdminAccount).filter_by(admin_user_id=admin_user_id.strip()).first()
    if not admin:
        write_audit(
            db,
            admin_id=None,
            action="ADMIN_LOGIN",
            resource_type="admin_account",
            resource_id=admin_user_id,
            result="DENIED",
            metadata={"reason": "unknown_admin"},
        )
        db.commit()
        raise AdminAuthError(401, "Invalid administrator identifier.")
    if admin.status != "ACTIVE":
        write_audit(
            db,
            admin_id=admin.id,
            action="ADMIN_LOGIN",
            resource_type="admin_account",
            resource_id=admin.admin_user_id,
            result="DENIED",
            metadata={"reason": "inactive"},
        )
        db.commit()
        raise AdminAuthError(403, "Administrator account is not active.")

    now = datetime.utcnow()
    pending = (
        db.query(AdminOtpRequest)
        .filter(
            AdminOtpRequest.admin_id == admin.id,
            AdminOtpRequest.status == "SENT",
        )
        .all()
    )
    for row in pending:
        row.status = "EXPIRED"

    otp = generate_otp_code()
    salt = generate_salt()
    request_id = secrets.token_urlsafe(18)
    provider = get_otp_provider()
    try:
        provider_ref = provider.send_otp(admin.phone_number, otp, request_id)
    except OTPProviderError as exc:
        write_audit(
            db,
            admin_id=admin.id,
            action="ADMIN_LOGIN",
            resource_type="otp",
            resource_id=request_id,
            result="FAILED",
            metadata={"reason": str(exc)},
        )
        db.commit()
        raise AdminAuthError(503, "Unable to send OTP at this time.") from exc

    record = AdminOtpRequest(
        admin_id=admin.id,
        request_id=request_id,
        otp_provider=provider.name,
        otp_salt=salt,
        otp_hash=hash_otp(otp, salt),
        provider_reference=provider_ref,
        created_at=now,
        expires_at=now + timedelta(seconds=_otp_expiry_seconds(db)),
        status="SENT",
    )
    db.add(record)
    write_audit(
        db,
        admin_id=admin.id,
        action="ADMIN_LOGIN",
        resource_type="otp",
        resource_id=request_id,
        result="SENT",
        metadata={"provider": provider.name},
    )
    db.commit()
    db.refresh(record)
    expiry_seconds = int((record.expires_at - record.created_at).total_seconds())
    payload = {
        "request_id": request_id,
        "expires_at": record.expires_at.isoformat() + "Z",
        "expires_in": expiry_seconds,
        "expires_in_seconds": expiry_seconds,
        "otp_provider": provider.name,
        "destination_hint": f"***{admin.phone_number[-4:]}",
        "demo_mode": config.CINTRA_DEMO_MODE,
    }
    if config.OTP_DEV_RETURN and not provider.uses_external_verification():
        payload["dev_otp"] = otp
        payload["demo_otp"] = otp
        payload["dev_otp_notice"] = "Returned only because OTP_DEV_RETURN is enabled. Not used in production."
    return payload


def verify_admin_otp(db: Session, admin_user_id: str, otp: str, request_id: str | None = None) -> dict:
    admin = db.query(AdminAccount).filter_by(admin_user_id=admin_user_id.strip()).first()
    if not admin or admin.status != "ACTIVE":
        raise AdminAuthError(401, "Invalid administrator identifier.")

    query = db.query(AdminOtpRequest).filter(
        AdminOtpRequest.admin_id == admin.id,
        AdminOtpRequest.status.in_(["SENT", "LOCKED"]),
    )
    if request_id:
        query = query.filter(AdminOtpRequest.request_id == request_id)
    record = query.order_by(AdminOtpRequest.created_at.desc()).first()
    if not record:
        raise AdminAuthError(400, "No active OTP request found.")

    now = datetime.utcnow()
    if record.status == "LOCKED":
        raise AdminAuthError(423, "OTP request is locked after too many attempts.")
    if record.expires_at <= now:
        record.status = "EXPIRED"
        db.commit()
        raise AdminAuthError(400, "OTP has expired.")

    max_attempts = _otp_max_attempts(db)
    try:
        if record.otp_provider == "twilio" and get_otp_provider().uses_external_verification():
            matched = get_otp_provider().verify_otp(admin.phone_number, otp.strip(), record.provider_reference)
        else:
            matched = otp_matches(otp.strip(), record.otp_salt, record.otp_hash)
    except OTPProviderError as exc:
        raise AdminAuthError(503, "Unable to verify OTP at this time.") from exc
    if not matched:
        record.attempt_count += 1
        if record.attempt_count >= max_attempts:
            record.status = "LOCKED"
            write_audit(
                db,
                admin_id=admin.id,
                action="ADMIN_LOGIN",
                resource_type="otp",
                resource_id=record.request_id,
                result="LOCKED",
            )
            db.commit()
            raise AdminAuthError(423, "Too many incorrect OTP attempts.")
        write_audit(
            db,
            admin_id=admin.id,
            action="ADMIN_LOGIN",
            resource_type="otp",
            resource_id=record.request_id,
            result="FAILED",
        )
        db.commit()
        remaining = max_attempts - record.attempt_count
        raise AdminAuthError(401, f"Incorrect OTP. {remaining} attempt(s) remaining.")

    record.status = "VERIFIED"
    record.verified_at = now
    token = secrets.token_urlsafe(32)
    session = AdminSession(
        admin_id=admin.id,
        token_hash=_hash_token(token),
        created_at=now,
        expires_at=now + timedelta(seconds=_session_timeout_seconds(db)),
        last_activity_at=now,
    )
    admin.last_login_at = now
    db.add(session)
    write_audit(
        db,
        admin_id=admin.id,
        action="ADMIN_LOGIN",
        resource_type="admin_session",
        resource_id=str(session.id) if session.id else admin.admin_user_id,
        result="SUCCESS",
    )
    db.commit()
    return {
        "access_token": token,
        "token_type": "bearer",
        "admin": serialize_admin(admin),
        "expires_in_seconds": _session_timeout_seconds(db),
    }


def logout_admin(db: Session, session: AdminSession, admin: AdminAccount) -> None:
    session.revoked_at = datetime.utcnow()
    write_audit(
        db,
        admin_id=admin.id,
        action="LOGOUT",
        resource_type="admin_session",
        resource_id=str(session.id),
        result="SUCCESS",
    )
    db.commit()


def get_session_by_token(db: Session, token: str) -> tuple[AdminSession, AdminAccount]:
    if not token:
        raise AdminAuthError(401, "Authentication required.")
    session = db.query(AdminSession).filter_by(token_hash=_hash_token(token)).first()
    if not session or session.revoked_at is not None:
        raise AdminAuthError(401, "Invalid or expired admin session.")
    now = datetime.utcnow()
    if session.expires_at <= now:
        raise AdminAuthError(401, "Your session expired due to inactivity. Please log in again.")
    admin = session.admin
    if admin.status != "ACTIVE":
        raise AdminAuthError(403, "Administrator account is not active.")
    session.last_activity_at = now
    session.expires_at = now + timedelta(seconds=_session_timeout_seconds(db))
    db.commit()
    db.refresh(session)
    db.refresh(admin)
    return session, admin


def serialize_admin(admin: AdminAccount, include_contact: bool = False) -> dict:
    payload = {
        "admin_user_id": admin.admin_user_id,
        "display_name": admin.display_name,
        "role": admin.role,
        "status": admin.status,
        "created_at": admin.created_at.isoformat() + "Z",
        "last_login_at": admin.last_login_at.isoformat() + "Z" if admin.last_login_at else None,
    }
    if include_contact:
        payload["email"] = admin.email
        payload["phone_last4"] = admin.phone_number[-4:]
    return payload
