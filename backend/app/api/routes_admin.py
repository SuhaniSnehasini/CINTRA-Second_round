from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AdminAccount, EvidenceRecord, Investigation, Officer, RecognitionEvent, Suspect
from ..services.admin_auth_service import AdminAuthError, logout_admin, send_admin_otp, serialize_admin, verify_admin_otp
from ..services.admin_ops import (
    analytics_overview,
    dashboard_overview,
    integrity_overview,
    list_audit,
    list_evidence,
    list_investigations,
    list_officers,
    list_persons,
    list_recognition,
    list_settings,
    serialize_event,
    serialize_evidence,
    serialize_investigation,
    serialize_officer,
    serialize_person,
    system_health,
    update_settings,
)
from ..services.audit_service import write_audit
from ..services.integrity_service import verify_evidence
from .deps import require_admin, require_permission

router = APIRouter(prefix="/admin", tags=["admin"])


class SendOtpBody(BaseModel):
    admin_user_id: str = Field(min_length=3, max_length=40)


class VerifyOtpBody(BaseModel):
    admin_user_id: str
    otp: str
    request_id: str | None = None


class OfficerCreateBody(BaseModel):
    officer_id: str
    name: str
    unit: str
    designation: str
    status: str = "ACTIVE"


class OfficerStatusBody(BaseModel):
    status: str


class AdminCreateBody(BaseModel):
    admin_user_id: str
    display_name: str
    role: str
    phone_number: str
    email: str


class AdminRoleBody(BaseModel):
    role: str | None = None
    status: str | None = None


class SettingsBody(BaseModel):
    recognition_threshold: float | None = None
    otp_expiry_seconds: int | None = None
    otp_max_attempts: int | None = None
    session_timeout_seconds: int | None = None


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text).replace(tzinfo=None)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid datetime filter.") from exc


def _audit_view(admin: AdminAccount, db: Session, action: str, resource_type: str, resource_id: str | None = None) -> None:
    write_audit(
        db,
        admin_id=admin.id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        result="SUCCESS",
    )
    db.commit()


@router.post("/auth/send-otp")
def admin_send_otp(body: SendOtpBody, db: Session = Depends(get_db)):
    try:
        return send_admin_otp(db, body.admin_user_id)
    except AdminAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/auth/verify-otp")
def admin_verify_otp(body: VerifyOtpBody, db: Session = Depends(get_db)):
    try:
        return verify_admin_otp(db, body.admin_user_id, body.otp, body.request_id)
    except AdminAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/auth/logout")
def admin_logout(ctx=Depends(require_admin)):
    admin, session, db = ctx
    logout_admin(db, session, admin)
    return {"ok": True}


@router.get("/me")
def admin_me(ctx=Depends(require_admin)):
    admin, _session, _db = ctx
    return serialize_admin(admin, include_contact=True)


@router.get("/dashboard/overview")
def admin_dashboard(ctx=Depends(require_permission("VIEW_ANALYTICS"))):
    admin, _session, db = ctx
    _audit_view(admin, db, "VIEW_ANALYTICS", "dashboard", "overview")
    return dashboard_overview(db)


@router.get("/officers")
def admin_officers(
    q: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 25,
    ctx=Depends(require_permission("VIEW_OFFICER")),
):
    admin, _session, db = ctx
    _audit_view(admin, db, "VIEW_OFFICER", "officer", q)
    return list_officers(db, q, status, page, page_size)


@router.post("/officers")
def admin_create_officer(body: OfficerCreateBody, ctx=Depends(require_permission("CREATE_OFFICER"))):
    admin, _session, db = ctx
    if body.status not in {"ACTIVE", "SUSPENDED", "DISABLED"}:
        raise HTTPException(status_code=422, detail="Invalid officer status.")
    if db.query(Officer).filter_by(officer_id=body.officer_id.strip()).first():
        raise HTTPException(status_code=409, detail="Officer ID already exists.")
    officer = Officer(
        officer_id=body.officer_id.strip(),
        name=body.name.strip(),
        unit=body.unit.strip(),
        designation=body.designation.strip(),
        status=body.status,
        data_origin="OPERATIONAL",
    )
    db.add(officer)
    write_audit(db, admin_id=admin.id, action="CREATE_OFFICER", resource_type="officer", resource_id=officer.officer_id, result="SUCCESS")
    db.commit()
    db.refresh(officer)
    return serialize_officer(db, officer, detailed=True)


@router.get("/officers/{officer_id}")
def admin_officer_detail(officer_id: str, ctx=Depends(require_permission("VIEW_OFFICER"))):
    admin, _session, db = ctx
    officer = db.query(Officer).filter_by(officer_id=officer_id).first()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found.")
    _audit_view(admin, db, "VIEW_OFFICER", "officer", officer_id)
    return serialize_officer(db, officer, detailed=True)


@router.post("/officers/{officer_id}/status")
def admin_officer_status(officer_id: str, body: OfficerStatusBody, ctx=Depends(require_permission("DISABLE_OFFICER"))):
    admin, _session, db = ctx
    if body.status not in {"ACTIVE", "SUSPENDED", "DISABLED"}:
        raise HTTPException(status_code=422, detail="Invalid officer status.")
    officer = db.query(Officer).filter_by(officer_id=officer_id).first()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found.")
    officer.status = body.status
    action = "DISABLE_OFFICER" if body.status != "ACTIVE" else "UPDATE_OFFICER"
    write_audit(db, admin_id=admin.id, action=action, resource_type="officer", resource_id=officer_id, result="SUCCESS")
    db.commit()
    db.refresh(officer)
    return serialize_officer(db, officer, detailed=True)


@router.get("/persons")
def admin_persons(
    q: str | None = None,
    enrollment_status: str | None = None,
    page: int = 1,
    page_size: int = 25,
    ctx=Depends(require_permission("VIEW_PERSON")),
):
    admin, _session, db = ctx
    _audit_view(admin, db, "VIEW_PERSON", "person", q)
    return list_persons(db, q, enrollment_status, page, page_size)


@router.get("/persons/{person_id}")
def admin_person_detail(person_id: str, ctx=Depends(require_permission("VIEW_PERSON"))):
    admin, _session, db = ctx
    person = db.query(Suspect).filter_by(suspect_code=person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")
    _audit_view(admin, db, "VIEW_PERSON", "person", person_id)
    return serialize_person(db, person, detailed=True)


@router.get("/recognition")
def admin_recognition(
    result: str | None = None,
    officer_id: str | None = None,
    person_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    min_score: float | None = None,
    max_score: float | None = None,
    page: int = 1,
    page_size: int = 25,
    ctx=Depends(require_permission("VIEW_RECOGNITION")),
):
    admin, _session, db = ctx
    _audit_view(admin, db, "VIEW_RECOGNITION", "recognition", result)
    return list_recognition(
        db,
        result=result,
        officer_id=officer_id,
        person_id=person_id,
        date_from=_parse_dt(date_from),
        date_to=_parse_dt(date_to),
        min_score=min_score,
        max_score=max_score,
        page=page,
        page_size=page_size,
    )


@router.get("/recognition/{event_id}")
def admin_recognition_detail(event_id: str, ctx=Depends(require_permission("VIEW_RECOGNITION"))):
    admin, _session, db = ctx
    event = db.query(RecognitionEvent).filter_by(event_id=event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Recognition event not found.")
    _audit_view(admin, db, "VIEW_RECOGNITION", "recognition", event_id)
    return serialize_event(event, detailed=True)


@router.get("/evidence")
def admin_evidence(
    q: str | None = None,
    status: str | None = None,
    evidence_type: str | None = None,
    page: int = 1,
    page_size: int = 25,
    ctx=Depends(require_permission("VIEW_EVIDENCE")),
):
    admin, _session, db = ctx
    _audit_view(admin, db, "VIEW_EVIDENCE", "evidence", q)
    return list_evidence(db, q, status, evidence_type, page, page_size)


@router.get("/evidence/{evidence_id}")
def admin_evidence_detail(evidence_id: str, ctx=Depends(require_permission("VIEW_EVIDENCE"))):
    admin, _session, db = ctx
    row = db.query(EvidenceRecord).filter_by(evidence_id=evidence_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Evidence not found.")
    _audit_view(admin, db, "VIEW_EVIDENCE", "evidence", evidence_id)
    return serialize_evidence(row, detailed=True)


@router.post("/evidence/{evidence_id}/verify")
def admin_evidence_verify(evidence_id: str, ctx=Depends(require_permission("VERIFY_EVIDENCE"))):
    admin, _session, db = ctx
    row = db.query(EvidenceRecord).filter_by(evidence_id=evidence_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Evidence not found.")
    result = verify_evidence(db, row)
    write_audit(db, admin_id=admin.id, action="VERIFY_EVIDENCE", resource_type="evidence", resource_id=evidence_id, result=result["integrity_status"])
    db.commit()
    return result


@router.get("/investigations")
def admin_investigations(
    q: str | None = None,
    officer_id: str | None = None,
    person_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    page_size: int = 25,
    ctx=Depends(require_permission("VIEW_INVESTIGATION")),
):
    admin, _session, db = ctx
    _audit_view(admin, db, "VIEW_INVESTIGATION", "investigation", q)
    return list_investigations(db, q, officer_id, person_id, _parse_dt(date_from), _parse_dt(date_to), page, page_size)


@router.get("/investigations/{case_id}")
def admin_investigation_detail(case_id: str, ctx=Depends(require_permission("VIEW_INVESTIGATION"))):
    admin, _session, db = ctx
    row = db.query(Investigation).filter_by(case_id=case_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Investigation not found.")
    _audit_view(admin, db, "VIEW_INVESTIGATION", "investigation", case_id)
    return serialize_investigation(row, detailed=True)


@router.get("/integrity")
def admin_integrity(ctx=Depends(require_permission("VIEW_INTEGRITY"))):
    admin, _session, db = ctx
    _audit_view(admin, db, "VIEW_INTEGRITY", "integrity", None)
    return integrity_overview(db)


@router.get("/analytics/overview")
def admin_analytics_overview(days: int = Query(14, ge=1, le=90), ctx=Depends(require_permission("VIEW_ANALYTICS"))):
    admin, _session, db = ctx
    _audit_view(admin, db, "VIEW_ANALYTICS", "analytics", "overview")
    return analytics_overview(db, days)


@router.get("/analytics/scans")
def admin_analytics_scans(days: int = Query(14, ge=1, le=90), ctx=Depends(require_permission("VIEW_ANALYTICS"))):
    admin, _session, db = ctx
    data = analytics_overview(db, days)
    return {"series": data["scans_per_day"]}


@router.get("/analytics/matches")
def admin_analytics_matches(days: int = Query(14, ge=1, le=90), ctx=Depends(require_permission("VIEW_ANALYTICS"))):
    _admin, _session, db = ctx
    data = analytics_overview(db, days)
    return {"series": data["matches_per_day"], "no_match": data["no_match_per_day"]}


@router.get("/analytics/officers")
def admin_analytics_officers(days: int = Query(14, ge=1, le=90), ctx=Depends(require_permission("VIEW_ANALYTICS"))):
    _admin, _session, db = ctx
    data = analytics_overview(db, days)
    return {"officers": data["activity_by_officer"]}


@router.get("/analytics/export.csv")
def admin_analytics_export(ctx=Depends(require_permission("EXPORT_REPORT"))):
    admin, _session, db = ctx
    data = analytics_overview(db, 30)
    write_audit(db, admin_id=admin.id, action="EXPORT_REPORT", resource_type="analytics", resource_id="overview", result="SUCCESS")
    db.commit()
    lines = ["metric,value"]
    for key, value in data["totals"].items():
        lines.append(f"{key},{value}")
    return PlainTextResponse("\n".join(lines) + "\n", media_type="text/csv")


@router.get("/audit")
def admin_audit(
    admin_user_id: str | None = None,
    action: str | None = None,
    resource: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    page_size: int = 25,
    ctx=Depends(require_permission("VIEW_AUDIT_LOG")),
):
    admin, _session, db = ctx
    _audit_view(admin, db, "VIEW_AUDIT_LOG", "audit", action)
    return list_audit(db, admin_user_id, action, resource, _parse_dt(date_from), _parse_dt(date_to), page, page_size)


@router.get("/system/health")
def admin_system_health(ctx=Depends(require_permission("VIEW_SYSTEM"))):
    admin, _session, db = ctx
    _audit_view(admin, db, "VIEW_SYSTEM", "system", "health")
    return system_health(db)


@router.get("/settings")
def admin_settings(ctx=Depends(require_permission("VIEW_SETTINGS"))):
    admin, _session, db = ctx
    _audit_view(admin, db, "VIEW_SETTINGS", "settings", None)
    return list_settings(db)


@router.put("/settings")
def admin_update_settings(body: SettingsBody, ctx=Depends(require_permission("CHANGE_SETTING"))):
    admin, _session, db = ctx
    updates = {key: value for key, value in body.model_dump().items() if value is not None}
    return update_settings(db, admin, updates)


@router.get("/admins")
def admin_list_admins(ctx=Depends(require_permission("MANAGE_ADMINS"))):
    admin, _session, db = ctx
    _audit_view(admin, db, "VIEW_ADMIN", "admin_account", None)
    rows = db.query(AdminAccount).order_by(AdminAccount.admin_user_id).all()
    return {"items": [serialize_admin(row, include_contact=True) for row in rows]}


@router.post("/admins")
def admin_create_admin(body: AdminCreateBody, ctx=Depends(require_permission("CREATE_ADMIN"))):
    actor, _session, db = ctx
    if body.role not in {"SUPER_ADMIN", "ADMIN", "AUDITOR"}:
        raise HTTPException(status_code=422, detail="Invalid role.")
    if db.query(AdminAccount).filter_by(admin_user_id=body.admin_user_id.strip()).first():
        raise HTTPException(status_code=409, detail="Admin user ID already exists.")
    created = AdminAccount(
        admin_user_id=body.admin_user_id.strip(),
        display_name=body.display_name.strip(),
        role=body.role,
        phone_number=body.phone_number.strip(),
        email=body.email.strip(),
        status="ACTIVE",
    )
    db.add(created)
    write_audit(db, admin_id=actor.id, action="CREATE_ADMIN", resource_type="admin_account", resource_id=created.admin_user_id, result="SUCCESS")
    db.commit()
    db.refresh(created)
    return serialize_admin(created, include_contact=True)


@router.post("/admins/{admin_user_id}")
def admin_update_admin(admin_user_id: str, body: AdminRoleBody, ctx=Depends(require_permission("CHANGE_ROLE"))):
    actor, _session, db = ctx
    target = db.query(AdminAccount).filter_by(admin_user_id=admin_user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found.")
    if body.role:
        if body.role not in {"SUPER_ADMIN", "ADMIN", "AUDITOR"}:
            raise HTTPException(status_code=422, detail="Invalid role.")
        target.role = body.role
        write_audit(db, admin_id=actor.id, action="CHANGE_ROLE", resource_type="admin_account", resource_id=admin_user_id, result="SUCCESS")
    if body.status:
        if body.status not in {"ACTIVE", "SUSPENDED", "DISABLED"}:
            raise HTTPException(status_code=422, detail="Invalid status.")
        target.status = body.status
        action = "DISABLE_ADMIN" if body.status != "ACTIVE" else "CHANGE_ROLE"
        write_audit(db, admin_id=actor.id, action=action, resource_type="admin_account", resource_id=admin_user_id, result="SUCCESS")
    db.commit()
    db.refresh(target)
    return serialize_admin(target, include_contact=True)
