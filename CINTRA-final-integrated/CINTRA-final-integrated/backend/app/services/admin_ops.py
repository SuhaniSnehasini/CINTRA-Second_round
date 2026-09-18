from datetime import datetime, timedelta
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session, joinedload

from .. import config
from ..models import (
    AdminAccount,
    AdminAuditLog,
    EvidenceRecord,
    Investigation,
    InvestigationLink,
    Officer,
    RecognitionEvent,
    Suspect,
    SystemSetting,
)
from .audit_service import write_audit
from .integrity_service import verify_evidence
from .otp_service import get_otp_provider
from ..config import SFACE_MODEL_PATH, UPLOAD_DIR, YUNET_MODEL_PATH


def paginate(query, page: int, page_size: int):
    page = max(1, page)
    page_size = min(100, max(1, page_size))
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": (total + page_size - 1) // page_size if page_size else 0,
    }


def start_of_today() -> datetime:
    now = datetime.utcnow()
    return datetime(now.year, now.month, now.day)


def dashboard_overview(db: Session) -> dict:
    today = start_of_today()
    scans_today = db.query(RecognitionEvent).filter(RecognitionEvent.timestamp >= today).count()
    matches_today = db.query(RecognitionEvent).filter(
        RecognitionEvent.timestamp >= today, RecognitionEvent.match_result == "MATCH"
    ).count()
    no_match_today = db.query(RecognitionEvent).filter(
        RecognitionEvent.timestamp >= today, RecognitionEvent.match_result == "NO_MATCH"
    ).count()
    recent = (
        db.query(RecognitionEvent)
        .order_by(RecognitionEvent.timestamp.desc())
        .limit(8)
        .all()
    )
    alerts = (
        db.query(AdminAuditLog)
        .filter(AdminAuditLog.result.in_(["FAILED", "DENIED", "LOCKED"]))
        .order_by(AdminAuditLog.timestamp.desc())
        .limit(8)
        .all()
    )
    return {
        "demo_mode": config.CINTRA_DEMO_MODE,
        "active_officers": db.query(Officer).filter_by(status="ACTIVE").count(),
        "enrolled_persons": db.query(Suspect).filter(Suspect.enrollment_status.in_(["REAL_ENROLLMENT", "DEMO_SEEDED", "VERIFIED"])).count(),
        "todays_scans": scans_today,
        "todays_matches": matches_today,
        "todays_no_matches": no_match_today,
        "evidence_records": db.query(EvidenceRecord).count(),
        "recent_activity": [_event_brief(row) for row in recent],
        "alerts": [_audit_brief(row) for row in alerts],
        "system_health": system_health(db),
    }


def _event_brief(row: RecognitionEvent) -> dict:
    return {
        "event_id": row.event_id,
        "timestamp": row.timestamp.isoformat() + "Z",
        "officer": row.officer_code,
        "person": row.person_code,
        "result": row.match_result,
        "confidence": row.confidence,
        "data_origin": row.data_origin,
    }


def _audit_brief(row: AdminAuditLog) -> dict:
    return {
        "timestamp": row.timestamp.isoformat() + "Z",
        "action": row.action,
        "resource_type": row.resource_type,
        "resource_id": row.resource_id,
        "result": row.result,
        "admin_user_id": row.admin.admin_user_id if row.admin else None,
    }


def officer_stats(db: Session, officer: Officer) -> dict:
    events = db.query(RecognitionEvent).filter(
        or_(RecognitionEvent.officer_id == officer.id, RecognitionEvent.officer_code == officer.officer_id)
    )
    total = events.count()
    matches = events.filter(RecognitionEvent.match_result == "MATCH").count()
    evidence_count = db.query(EvidenceRecord).filter(
        or_(EvidenceRecord.officer_id == officer.id, EvidenceRecord.officer_code == officer.officer_id)
    ).count()
    return {"total_scans": total, "matches": matches, "evidence_count": evidence_count}


def serialize_officer(db: Session, officer: Officer, detailed: bool = False) -> dict:
    stats = officer_stats(db, officer)
    payload = {
        "officer_id": officer.officer_id,
        "name": officer.name,
        "unit": officer.unit,
        "designation": officer.designation,
        "status": officer.status,
        "created_at": officer.created_at.isoformat() + "Z",
        "last_login_at": officer.last_login_at.isoformat() + "Z" if officer.last_login_at else None,
        "data_origin": officer.data_origin,
        **stats,
    }
    if detailed:
        recent_events = (
            db.query(RecognitionEvent)
            .filter(or_(RecognitionEvent.officer_id == officer.id, RecognitionEvent.officer_code == officer.officer_id))
            .order_by(RecognitionEvent.timestamp.desc())
            .limit(15)
            .all()
        )
        recent_evidence = (
            db.query(EvidenceRecord)
            .filter(or_(EvidenceRecord.officer_id == officer.id, EvidenceRecord.officer_code == officer.officer_id))
            .order_by(EvidenceRecord.created_at.desc())
            .limit(15)
            .all()
        )
        payload["recent_activity"] = [_event_brief(row) for row in recent_events]
        payload["evidence_activity"] = [
            {
                "evidence_id": row.evidence_id,
                "type": row.evidence_type,
                "captured_at": row.captured_at.isoformat() + "Z",
                "integrity_status": row.integrity_status,
            }
            for row in recent_evidence
        ]
        payload["authentication_status"] = "ACTIVE" if officer.status == "ACTIVE" else officer.status
    return payload


def list_officers(db: Session, q: str | None, status: str | None, page: int, page_size: int):
    query = db.query(Officer)
    if status:
        query = query.filter(Officer.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Officer.officer_id.ilike(like), Officer.name.ilike(like), Officer.unit.ilike(like)))
    query = query.order_by(Officer.officer_id)
    result = paginate(query, page, page_size)
    result["items"] = [serialize_officer(db, row) for row in result["items"]]
    return result


def serialize_person(db: Session, person: Suspect, detailed: bool = False) -> dict:
    last = (
        db.query(RecognitionEvent)
        .filter(or_(RecognitionEvent.person_id == person.id, RecognitionEvent.person_code == person.suspect_code))
        .order_by(RecognitionEvent.timestamp.desc())
        .first()
    )
    recognition_count = db.query(RecognitionEvent).filter(
        or_(RecognitionEvent.person_id == person.id, RecognitionEvent.person_code == person.suspect_code)
    ).count()
    payload = {
        "person_id": person.suspect_code,
        "display_name": person.name,
        "role": person.role,
        "wanted": person.wanted,
        "enrollment_status": person.enrollment_status,
        "reference_image_count": person.reference_image_count,
        "enrollment_date": person.enrollment_date.isoformat() + "Z" if person.enrollment_date else None,
        "last_recognition": last.timestamp.isoformat() + "Z" if last else None,
        "recognition_count": recognition_count,
        "data_origin": person.data_origin,
        "officer_directory": person.include_in_officer_directory,
    }
    if detailed:
        payload["face_processing"] = {
            "model_records": [
                {
                    "model_name": row.model_name,
                    "model_version": row.model_version,
                    "enrollment_kind": row.enrollment_kind,
                    "quality_score": row.quality_score,
                    "created_at": row.created_at.isoformat() + "Z",
                    "has_embedding": False,
                }
                for row in person.representations
            ],
            "embeddings_exposed": False,
        }
        history = (
            db.query(RecognitionEvent)
            .filter(or_(RecognitionEvent.person_id == person.id, RecognitionEvent.person_code == person.suspect_code))
            .order_by(RecognitionEvent.timestamp.desc())
            .limit(25)
            .all()
        )
        payload["recognition_history"] = [_event_brief(row) for row in history]
        evidence = (
            db.query(EvidenceRecord)
            .join(RecognitionEvent, EvidenceRecord.recognition_event_id == RecognitionEvent.id, isouter=True)
            .filter(or_(RecognitionEvent.person_id == person.id, RecognitionEvent.person_code == person.suspect_code))
            .order_by(EvidenceRecord.created_at.desc())
            .limit(25)
            .all()
        )
        payload["linked_evidence"] = [row.evidence_id for row in evidence]
    return payload


def list_persons(db: Session, q: str | None, enrollment_status: str | None, page: int, page_size: int):
    query = db.query(Suspect)
    if enrollment_status:
        query = query.filter(Suspect.enrollment_status == enrollment_status)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Suspect.suspect_code.ilike(like), Suspect.name.ilike(like), Suspect.role.ilike(like)))
    query = query.order_by(Suspect.suspect_code)
    result = paginate(query, page, page_size)
    result["items"] = [serialize_person(db, row) for row in result["items"]]
    return result


def serialize_event(row: RecognitionEvent, detailed: bool = False) -> dict:
    payload = {
        "event_id": row.event_id,
        "timestamp": row.timestamp.isoformat() + "Z",
        "officer": row.officer_code,
        "person": row.person_code,
        "score": row.confidence,
        "result": row.match_result,
        "model_version": row.model_version,
        "status": row.status,
        "data_origin": row.data_origin,
    }
    if detailed:
        payload.update({
            "threshold_used": row.threshold_used,
            "processing_duration_ms": row.processing_duration_ms,
            "message": row.message,
            "linked_evidence": [
                {
                    "evidence_id": ev.evidence_id,
                    "type": ev.evidence_type,
                    "integrity_status": ev.integrity_status,
                    "sha256": ev.sha256_hash,
                }
                for ev in row.evidence_records
            ],
        })
    return payload


def list_recognition(
    db: Session,
    *,
    result: str | None,
    officer_id: str | None,
    person_id: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    min_score: float | None,
    max_score: float | None,
    page: int,
    page_size: int,
):
    query = db.query(RecognitionEvent)
    if result:
        query = query.filter(RecognitionEvent.match_result == result)
    if officer_id:
        query = query.filter(RecognitionEvent.officer_code == officer_id)
    if person_id:
        query = query.filter(RecognitionEvent.person_code == person_id)
    if date_from:
        query = query.filter(RecognitionEvent.timestamp >= date_from)
    if date_to:
        query = query.filter(RecognitionEvent.timestamp <= date_to)
    if min_score is not None:
        query = query.filter(RecognitionEvent.confidence >= min_score)
    if max_score is not None:
        query = query.filter(RecognitionEvent.confidence <= max_score)
    query = query.order_by(RecognitionEvent.timestamp.desc())
    page_result = paginate(query, page, page_size)
    page_result["items"] = [serialize_event(row) for row in page_result["items"]]
    return page_result


def serialize_evidence(row: EvidenceRecord, detailed: bool = False) -> dict:
    payload = {
        "evidence_id": row.evidence_id,
        "type": row.evidence_type,
        "captured_at": row.captured_at.isoformat() + "Z",
        "officer": row.officer_code,
        "recognition_event": row.recognition_event.event_id if row.recognition_event else None,
        "sha256": row.sha256_hash,
        "integrity_status": row.integrity_status,
        "data_origin": row.data_origin,
    }
    if detailed:
        rec = row.recognition_event
        payload.update({
            "record_hash": row.record_hash,
            "previous_record_hash": row.previous_record_hash,
            "chain_reference": row.chain_reference,
            "file_path": row.file_path,
            "original_filename": row.original_filename,
            "recognition_result": rec.match_result if rec else None,
            "recognition_score": rec.confidence if rec else None,
            "mechanism": "CHAIN-OF-RECORD / INTEGRITY VERIFICATION",
            "blockchain_claimed": False,
        })
    return payload


def list_evidence(db: Session, q: str | None, status: str | None, evidence_type: str | None, page: int, page_size: int):
    query = db.query(EvidenceRecord).options(joinedload(EvidenceRecord.recognition_event))
    if status:
        query = query.filter(EvidenceRecord.integrity_status == status)
    if evidence_type:
        query = query.filter(EvidenceRecord.evidence_type == evidence_type)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(EvidenceRecord.evidence_id.ilike(like), EvidenceRecord.officer_code.ilike(like), EvidenceRecord.sha256_hash.ilike(like)))
    query = query.order_by(EvidenceRecord.captured_at.desc())
    result = paginate(query, page, page_size)
    result["items"] = [serialize_evidence(row) for row in result["items"]]
    return result


def serialize_investigation(row: Investigation, detailed: bool = False) -> dict:
    payload = {
        "case_id": row.case_id,
        "title": row.title,
        "status": row.status,
        "officer": row.officer.officer_id if row.officer else None,
        "person": row.person.suspect_code if row.person else None,
        "created_at": row.created_at.isoformat() + "Z",
        "data_origin": row.data_origin,
    }
    if detailed:
        links = sorted(row.links, key=lambda item: item.occurred_at)
        payload["summary"] = row.summary
        payload["timeline"] = [
            {
                "occurred_at": link.occurred_at.isoformat() + "Z",
                "label": link.label,
                "resource_type": link.resource_type,
                "resource_id": link.resource_id,
            }
            for link in links
        ]
    return payload


def list_investigations(db: Session, q: str | None, officer_id: str | None, person_id: str | None, date_from: datetime | None, date_to: datetime | None, page: int, page_size: int):
    query = db.query(Investigation)
    if officer_id:
        query = query.join(Officer, Investigation.officer_id == Officer.id).filter(Officer.officer_id == officer_id)
    if person_id:
        query = query.join(Suspect, Investigation.person_id == Suspect.id).filter(Suspect.suspect_code == person_id)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Investigation.case_id.ilike(like), Investigation.title.ilike(like)))
    if date_from:
        query = query.filter(Investigation.created_at >= date_from)
    if date_to:
        query = query.filter(Investigation.created_at <= date_to)
    query = query.order_by(Investigation.created_at.desc())
    result = paginate(query, page, page_size)
    result["items"] = [serialize_investigation(row) for row in result["items"]]
    return result


def integrity_overview(db: Session) -> dict:
    total = db.query(EvidenceRecord).count()
    verified = db.query(EvidenceRecord).filter(EvidenceRecord.integrity_status.in_(["VERIFIED", "CHAIN_VERIFIED", "HASHED"])).count()
    pending = db.query(EvidenceRecord).filter(EvidenceRecord.integrity_status == "PENDING").count()
    failed = db.query(EvidenceRecord).filter(EvidenceRecord.integrity_status == "FAILED").count()
    latest = db.query(EvidenceRecord).order_by(EvidenceRecord.id.desc()).limit(20).all()
    return {
        "mechanism": "CHAIN-OF-RECORD / INTEGRITY VERIFICATION",
        "blockchain_claimed": False,
        "total_records": total,
        "verified_records": verified,
        "pending_records": pending,
        "integrity_alerts": failed,
        "recent": [serialize_evidence(row, detailed=True) for row in latest],
    }


def _day_counts(db: Session, result: str | None, days: int) -> list[dict]:
    start = start_of_today() - timedelta(days=days - 1)
    rows = db.query(RecognitionEvent).filter(RecognitionEvent.timestamp >= start).all()
    buckets = {(start + timedelta(days=i)).date().isoformat(): {"scans": 0, "matches": 0, "no_matches": 0} for i in range(days)}
    for row in rows:
        key = row.timestamp.date().isoformat()
        if key not in buckets:
            continue
        buckets[key]["scans"] += 1
        if row.match_result == "MATCH":
            buckets[key]["matches"] += 1
        if row.match_result == "NO_MATCH":
            buckets[key]["no_matches"] += 1
    series = [{"date": day, **vals} for day, vals in buckets.items()]
    if result == "MATCH":
        return [{"date": item["date"], "count": item["matches"]} for item in series]
    if result == "NO_MATCH":
        return [{"date": item["date"], "count": item["no_matches"]} for item in series]
    return [{"date": item["date"], "count": item["scans"]} for item in series]


def analytics_overview(db: Session, days: int = 14) -> dict:
    events = db.query(RecognitionEvent).all()
    dist = {"MATCH": 0, "NO_MATCH": 0, "LOW_CONFIDENCE": 0, "PROCESSING_ERROR": 0}
    scores = []
    for row in events:
        dist[row.match_result] = dist.get(row.match_result, 0) + 1
        if row.confidence is not None:
            scores.append(row.confidence)
    officer_rows = (
        db.query(RecognitionEvent.officer_code, func.count(RecognitionEvent.id))
        .group_by(RecognitionEvent.officer_code)
        .order_by(func.count(RecognitionEvent.id).desc())
        .limit(12)
        .all()
    )
    evidence_days = _evidence_over_time(db, days)
    return {
        "totals": {
            "scans": len(events),
            "matches": dist.get("MATCH", 0),
            "no_matches": dist.get("NO_MATCH", 0),
            "low_confidence": dist.get("LOW_CONFIDENCE", 0),
            "errors": dist.get("PROCESSING_ERROR", 0),
            "evidence": db.query(EvidenceRecord).count(),
        },
        "scans_per_day": _day_counts(db, None, days),
        "matches_per_day": _day_counts(db, "MATCH", days),
        "no_match_per_day": _day_counts(db, "NO_MATCH", days),
        "confidence_distribution": _confidence_buckets(scores),
        "activity_by_officer": [{"officer_id": code or "UNASSIGNED", "scans": count} for code, count in officer_rows],
        "evidence_over_time": evidence_days,
    }


def _evidence_over_time(db: Session, days: int) -> list[dict]:
    start = start_of_today() - timedelta(days=days - 1)
    rows = db.query(EvidenceRecord).filter(EvidenceRecord.created_at >= start).all()
    buckets = {(start + timedelta(days=i)).date().isoformat(): 0 for i in range(days)}
    for row in rows:
        key = row.created_at.date().isoformat()
        if key in buckets:
            buckets[key] += 1
    return [{"date": day, "count": count} for day, count in buckets.items()]


def _confidence_buckets(scores: list[float]) -> list[dict]:
    labels = ["0-20", "20-40", "40-60", "60-80", "80-100"]
    counts = [0, 0, 0, 0, 0]
    for score in scores:
        if score < 20:
            counts[0] += 1
        elif score < 40:
            counts[1] += 1
        elif score < 60:
            counts[2] += 1
        elif score < 80:
            counts[3] += 1
        else:
            counts[4] += 1
    return [{"bucket": labels[i], "count": counts[i]} for i in range(5)]


def list_audit(db: Session, admin_user_id: str | None, action: str | None, resource: str | None, date_from: datetime | None, date_to: datetime | None, page: int, page_size: int):
    query = db.query(AdminAuditLog).options(joinedload(AdminAuditLog.admin))
    if admin_user_id:
        query = query.join(AdminAccount).filter(AdminAccount.admin_user_id == admin_user_id)
    if action:
        query = query.filter(AdminAuditLog.action == action)
    if resource:
        query = query.filter(AdminAuditLog.resource_type == resource)
    if date_from:
        query = query.filter(AdminAuditLog.timestamp >= date_from)
    if date_to:
        query = query.filter(AdminAuditLog.timestamp <= date_to)
    query = query.order_by(AdminAuditLog.timestamp.desc())
    result = paginate(query, page, page_size)
    result["items"] = [_audit_brief(row) for row in result["items"]]
    return result


def system_health(db: Session) -> dict:
    checks = {}
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = {"status": "healthy", "detail": "query succeeded"}
    except Exception:
        checks["database"] = {"status": "unhealthy", "detail": "database query failed"}
    checks["api"] = {"status": "healthy", "detail": "admin health endpoint reachable"}
    rec_ok = YUNET_MODEL_PATH.is_file() and SFACE_MODEL_PATH.is_file()
    checks["recognition"] = {
        "status": "healthy" if rec_ok else "degraded",
        "detail": "YuNet and SFace models present" if rec_ok else "recognition models missing",
    }
    provider = get_otp_provider()
    otp_ok = True
    otp_detail = f"provider={provider.name}"
    if provider.name == "twilio":
        otp_ok = bool(config.TWILIO_ACCOUNT_SID and config.TWILIO_AUTH_TOKEN)
        otp_detail = "twilio credentials present" if otp_ok else "twilio credentials missing"
    checks["otp"] = {"status": "healthy" if otp_ok else "unhealthy", "detail": otp_detail}
    try:
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        probe = UPLOAD_DIR / ".health"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        checks["storage"] = {"status": "healthy", "detail": str(UPLOAD_DIR)}
    except Exception:
        checks["storage"] = {"status": "unhealthy", "detail": "upload directory not writable"}
    overall = "healthy"
    if any(item["status"] == "unhealthy" for item in checks.values()):
        overall = "unhealthy"
    elif any(item["status"] == "degraded" for item in checks.values()):
        overall = "degraded"
    return {"overall": overall, "checks": checks}


DEFAULT_SETTINGS = {
    "recognition_threshold": str(config.DEMO_MATCH_THRESHOLD),
    "otp_expiry_seconds": str(config.OTP_EXPIRY_SECONDS),
    "otp_max_attempts": str(config.OTP_MAX_ATTEMPTS),
    "session_timeout_seconds": str(config.ADMIN_SESSION_TIMEOUT_SECONDS),
}


def list_settings(db: Session) -> dict:
    rows = {row.key: row.value for row in db.query(SystemSetting).all()}
    merged = {**DEFAULT_SETTINGS, **rows}
    return {"settings": merged, "source": "database_with_config_defaults"}


def update_settings(db: Session, admin: AdminAccount, updates: dict) -> dict:
    allowed = set(DEFAULT_SETTINGS)
    for key, value in updates.items():
        if key not in allowed:
            continue
        row = db.query(SystemSetting).filter_by(key=key).first()
        if row:
            row.value = str(value)
            row.updated_by_admin_id = admin.id
        else:
            db.add(SystemSetting(key=key, value=str(value), updated_by_admin_id=admin.id))
        write_audit(
            db,
            admin_id=admin.id,
            action="CHANGE_SETTING",
            resource_type="system_setting",
            resource_id=key,
            result="SUCCESS",
            metadata={"value": str(value)},
        )
    db.commit()
    return list_settings(db)
