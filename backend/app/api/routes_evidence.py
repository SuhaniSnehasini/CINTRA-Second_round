cat > import hashlib
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import CustodyEvent, Evidence
from ..services.fabric_service import (
    FabricServiceError,
    get_fabric_history,
    record_custody_event,
)

router = APIRouter(
    prefix="/evidence",
    tags=["Evidence"],
)

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)

UPLOAD_DIR = os.path.join(
    BASE_DIR,
    "uploads",
)

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True,
)


def _utc_now() -> datetime:
    return datetime.utcnow()


def _timestamp_string(value: datetime | None) -> str:
    if value is None:
        value = _utc_now()

    return (
        value.replace(tzinfo=timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )

        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(
                timezone.utc
            ).replace(tzinfo=None)

        return parsed

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid collection_timestamp. "
                "Use ISO-8601 format, for example "
                "2026-09-15T10:30:00Z."
            ),
        )


def _serialize_evidence(evidence: Evidence) -> dict:
    return {
        "id": evidence.id,
        "evidence_id": evidence.evidence_id,
        "case_id": evidence.case_id,
        "filename": evidence.filename,
        "original_filename": evidence.original_filename,
        "evidence_type": evidence.evidence_type,
        "mime_type": evidence.mime_type,
        "file_path": evidence.file_path,
        "sha256": evidence.sha256,
        "size_bytes": evidence.size_bytes,
        "original_badge_id": evidence.original_badge_id,
        "current_custodian": evidence.current_custodian,
        "collector_name": evidence.collector_name,
        "collector_agency": evidence.collector_agency,
        "collection_timestamp": (
            evidence.collection_timestamp.isoformat()
            if evidence.collection_timestamp
            else None
        ),
        "description": evidence.description,
        "status": evidence.status,
        "registered_at": (
            evidence.registered_at.isoformat()
            if evidence.registered_at
            else None
        ),
        "updated_at": (
            evidence.updated_at.isoformat()
            if evidence.updated_at
            else None
        ),
    }


def _serialize_event(event: CustodyEvent) -> dict:
    return {
        "event_id": event.event_id,
        "evidence_id": event.evidence_id,
        "action": event.action,
        "actor_badge_id": event.actor_badge_id,
        "from_custodian": event.from_custodian,
        "to_custodian": event.to_custodian,
        "reason": event.reason,
        "file_sha256": event.file_sha256,
        "timestamp": (
            event.timestamp.isoformat()
            if event.timestamp
            else None
        ),
        "blockchain_tx_id": event.blockchain_tx_id,
        "blockchain_status": event.blockchain_status,
    }


def _get_evidence(
    db: Session,
    evidence_id: str,
) -> Evidence:
    evidence = (
        db.query(Evidence)
        .filter(
            Evidence.evidence_id == evidence_id
        )
        .first()
    )

    if evidence is None:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found.",
        )

    return evidence


def _record_local_event(
    db: Session,
    *,
    evidence: Evidence,
    action: str,
    actor_badge_id: str | None,
    from_custodian: str | None,
    to_custodian: str | None,
    reason: str | None,
    event_timestamp: datetime | None = None,
) -> CustodyEvent:
    event_id = (
        f"CUSTODY-{uuid.uuid4().hex[:20].upper()}"
    )

    event = CustodyEvent(
        event_id=event_id,
        evidence_id=evidence.evidence_id,
        action=action,
        actor_badge_id=actor_badge_id,
        from_custodian=from_custodian,
        to_custodian=to_custodian,
        reason=reason,
        file_sha256=evidence.sha256,
        timestamp=(
            event_timestamp
            if event_timestamp is not None
            else _utc_now()
        ),
        blockchain_tx_id=None,
        blockchain_status="NOT_RECORDED",
    )

    db.add(event)
    db.flush()

    return event


def _record_fabric_for_event(
    *,
    event: CustodyEvent,
) -> dict:
    return record_custody_event(
        evidence_id=event.evidence_id,
        event_id=event.event_id,
        action=event.action,
        actor_badge_id=event.actor_badge_id,
        from_custodian=event.from_custodian,
        to_custodian=event.to_custodian,
        reason=event.reason,
        file_sha256=event.file_sha256,
        timestamp=_timestamp_string(
            event.timestamp
        ),
    )


@router.post("/upload")
async def upload_evidence(
    file: UploadFile = File(...),
    type: str = Form("Evidence"),
    badge_id: str | None = Form(None),
    case_id: str | None = Form(None),
    collector_name: str | None = Form(None),
    collector_agency: str | None = Form(None),
    collection_timestamp: str | None = Form(None),
    description: str | None = Form(None),
):
    """
    Upload an evidence file, calculate its SHA-256 hash,
    register it locally, and record the initial custody
    event on Hyperledger Fabric.
    """

    db = SessionLocal()

    evidence = None
    file_path = None

    try:
        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail="No filename supplied.",
            )

        original_filename = os.path.basename(
            file.filename
        )

        file_extension = os.path.splitext(
            original_filename
        )[1]

        evidence_id = (
            f"EVIDENCE-{uuid.uuid4().hex[:20].upper()}"
        )

        stored_filename = (
            f"{evidence_id}{file_extension}"
        )

        file_path = os.path.join(
            UPLOAD_DIR,
            stored_filename,
        )

        sha256 = hashlib.sha256()
        size_bytes = 0

        with open(file_path, "wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                output.write(chunk)
                sha256.update(chunk)
                size_bytes += len(chunk)

        file_hash = sha256.hexdigest()

        collection_dt = _parse_timestamp(
            collection_timestamp
        )

        if collection_dt is None:
            collection_dt = _utc_now()

        evidence = Evidence(
            evidence_id=evidence_id,
            case_id=case_id,
            filename=stored_filename,
            original_filename=original_filename,
            evidence_type=type,
            mime_type=file.content_type,
            file_path=file_path,
            sha256=file_hash,
            size_bytes=size_bytes,
            original_badge_id=badge_id,
            current_custodian=badge_id,
            collector_name=collector_name,
            collector_agency=collector_agency,
            collection_timestamp=collection_dt,
            description=description,
            status="IN_CUSTODY",
            registered_at=_utc_now(),
            updated_at=_utc_now(),
        )

        db.add(evidence)
        db.flush()

        event = _record_local_event(
            db,
            evidence=evidence,
            action="REGISTERED",
            actor_badge_id=badge_id,
            from_custodian=None,
            to_custodian=badge_id,
            reason="Evidence registered.",
            event_timestamp=collection_dt,
        )

        fabric_result = None

        try:
            fabric_result = _record_fabric_for_event(
                event=event
            )

            event.blockchain_tx_id = (
                fabric_result.get(
                    "transaction_id"
                )
            )

            event.blockchain_status = "RECORDED"

        except FabricServiceError as exc:
            event.blockchain_status = "FAILED"

            db.commit()

            return {
                "success": False,
                "message": (
                    "Evidence was uploaded locally, "
                    "but blockchain custody recording failed."
                ),
                "evidence": _serialize_evidence(
                    evidence
                ),
                "custody_event": _serialize_event(
                    event
                ),
                "blockchain_status": "FAILED",
                "blockchain_error": str(exc),
            }

        db.commit()

        return {
            "success": True,
            "message": "Evidence uploaded successfully.",
            "evidence": _serialize_evidence(
                evidence
            ),
            "custody_event": _serialize_event(
                event
            ),
            "blockchain_status": "RECORDED",
            "transaction_id": (
                event.blockchain_tx_id
            ),
            "fabric": fabric_result,
        }

    except HTTPException:
        db.rollback()

        if file_path and os.path.exists(file_path):
            os.remove(file_path)

        raise

    except Exception as exc:
        db.rollback()

        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        raise HTTPException(
            status_code=500,
            detail=f"Evidence upload failed: {exc}",
        )

    finally:
        await file.close()
        db.close()


@router.get("/{evidence_id}")
def get_evidence(
    evidence_id: str,
):
    db = SessionLocal()

    try:
        evidence = _get_evidence(
            db,
            evidence_id,
        )

        return {
            "success": True,
            "evidence": _serialize_evidence(
                evidence
            ),
        }

    finally:
        db.close()


@router.get("/{evidence_id}/custody")
def get_custody_history(
    evidence_id: str,
):
    db = SessionLocal()

    try:
        evidence = _get_evidence(
            db,
            evidence_id,
        )

        local_events = (
            db.query(CustodyEvent)
            .filter(
                CustodyEvent.evidence_id
                == evidence_id
            )
            .order_by(
                CustodyEvent.timestamp.asc()
            )
            .all()
        )

        fabric_history = []

        try:
            fabric_result = get_fabric_history(
                evidence_id
            )

            fabric_history = (
                fabric_result.get(
                    "events",
                    []
                )
                if isinstance(
                    fabric_result,
                    dict,
                )
                else []
            )

        except Exception as exc:
            fabric_result = {
                "success": False,
                "error": str(exc),
                "events": [],
            }

        return {
            "success": True,
            "evidence": _serialize_evidence(
                evidence
            ),
            "local_event_count": len(
                local_events
            ),
            "fabric_event_count": len(
                fabric_history
            ),
            "events": [
                _serialize_event(event)
                for event in local_events
            ],
            "fabric_events": fabric_history,
            "fabric": fabric_result,
        }

    finally:
        db.close()


@router.post("/{evidence_id}/transfer")
def transfer_evidence(
    evidence_id: str,
    to_custodian: str = Form(...),
    actor_badge_id: str | None = Form(None),
    reason: str | None = Form(None),
):
    db = SessionLocal()

    try:
        evidence = _get_evidence(
            db,
            evidence_id,
        )

        if not to_custodian.strip():
            raise HTTPException(
                status_code=400,
                detail="to_custodian is required.",
            )

        from_custodian = (
            evidence.current_custodian
        )

        event = _record_local_event(
            db,
            evidence=evidence,
            action="TRANSFER",
            actor_badge_id=actor_badge_id,
            from_custodian=from_custodian,
            to_custodian=to_custodian,
            reason=reason,
        )

        try:
            fabric_result = _record_fabric_for_event(
                event=event
            )

            event.blockchain_tx_id = (
                fabric_result.get(
                    "transaction_id"
                )
            )

            event.blockchain_status = "RECORDED"

        except FabricServiceError as exc:
            event.blockchain_status = "FAILED"

            db.commit()

            raise HTTPException(
                status_code=502,
                detail=(
                    "Transfer was saved locally, "
                    "but Fabric recording failed: "
                    f"{exc}"
                ),
            )

        evidence.current_custodian = (
            to_custodian
        )
        evidence.updated_at = _utc_now()

        db.commit()

        return {
            "success": True,
            "message": "Evidence transferred successfully.",
            "evidence": _serialize_evidence(
                evidence
            ),
            "custody_event": _serialize_event(
                event
            ),
            "transaction_id": (
                event.blockchain_tx_id
            ),
            "blockchain_status": "RECORDED",
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Evidence transfer failed: {exc}",
        )

    finally:
        db.close()


@router.post("/{evidence_id}/access")
def record_evidence_access(
    evidence_id: str,
    actor_badge_id: str | None = Form(None),
    reason: str | None = Form(None),
):
    db = SessionLocal()

    try:
        evidence = _get_evidence(
            db,
            evidence_id,
        )

        event = _record_local_event(
            db,
            evidence=evidence,
            action="ACCESS",
            actor_badge_id=actor_badge_id,
            from_custodian=evidence.current_custodian,
            to_custodian=evidence.current_custodian,
            reason=reason or "Evidence accessed.",
        )

        try:
            fabric_result = _record_fabric_for_event(
                event=event
            )

            event.blockchain_tx_id = (
                fabric_result.get(
                    "transaction_id"
                )
            )

            event.blockchain_status = "RECORDED"

        except FabricServiceError as exc:
            event.blockchain_status = "FAILED"

            db.commit()

            raise HTTPException(
                status_code=502,
                detail=(
                    "Evidence access was saved locally, "
                    "but Fabric recording failed: "
                    f"{exc}"
                ),
            )

        evidence.updated_at = _utc_now()

        db.commit()

        return {
            "success": True,
            "message": "Evidence access recorded.",
            "custody_event": _serialize_event(
                event
            ),
            "transaction_id": (
                event.blockchain_tx_id
            ),
            "blockchain_status": "RECORDED",
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Evidence access failed: {exc}",
        )

    finally:
        db.close()


@router.post("/{evidence_id}/verify")
def verify_evidence(
    evidence_id: str,
):
    db = SessionLocal()

    try:
        evidence = _get_evidence(
            db,
            evidence_id,
        )

        if not os.path.exists(
            evidence.file_path
        ):
            return {
                "success": False,
                "evidence_id": evidence_id,
                "integrity_status": "FILE_MISSING",
                "message": "Stored evidence file is missing.",
            }

        sha256 = hashlib.sha256()

        with open(
            evidence.file_path,
            "rb",
        ) as input_file:
            while True:
                chunk = input_file.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                sha256.update(chunk)

        current_hash = sha256.hexdigest()

        matches = (
            current_hash.lower()
            == evidence.sha256.lower()
        )

        return {
            "success": True,
            "evidence_id": evidence_id,
            "stored_sha256": evidence.sha256,
            "current_sha256": current_hash,
            "integrity_status": (
                "VERIFIED"
                if matches
                else "MISMATCH"
            ),
            "verified": matches,
        }

    finally:
        db.close()


@router.post("/{evidence_id}/reconcile")
def reconcile_evidence(
    evidence_id: str,
):
    db = SessionLocal()

    try:
        evidence = _get_evidence(
            db,
            evidence_id,
        )

        local_events = (
            db.query(CustodyEvent)
            .filter(
                CustodyEvent.evidence_id
                == evidence_id
            )
            .order_by(
                CustodyEvent.timestamp.asc()
            )
            .all()
        )

        try:
            fabric_result = get_fabric_history(
                evidence_id
            )

        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Unable to retrieve Fabric custody "
                    f"history: {exc}"
                ),
            )

        fabric_events = (
            fabric_result.get(
                "events",
                []
            )
            if isinstance(
                fabric_result,
                dict,
            )
            else []
        )

        fabric_by_event_id = {}

        for fabric_event in fabric_events:
            event_id = fabric_event.get(
                "eventId"
            ) or fabric_event.get(
                "event_id"
            )

            if event_id:
                fabric_by_event_id[
                    event_id
                ] = fabric_event

        synchronized_count = 0

        for event in local_events:
            fabric_event = (
                fabric_by_event_id.get(
                    event.event_id
                )
            )

            if fabric_event:
                tx_id = (
                    fabric_event.get(
                        "blockchainTxId"
                    )
                    or fabric_event.get(
                        "blockchain_tx_id"
                    )
                )

                if tx_id:
                    event.blockchain_tx_id = (
                        tx_id
                    )

                event.blockchain_status = (
                    "RECORDED"
                )

                synchronized_count += 1

        db.commit()

        return {
            "success": True,
            "evidence_id": evidence_id,
            "local_event_count": len(
                local_events
            ),
            "fabric_event_count": len(
                fabric_events
            ),
            "synchronized_count": synchronized_count,
            "events": [
                _serialize_event(event)
                for event in local_events
            ],
            "fabric_events": fabric_events,
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                f"Evidence reconciliation failed: {exc}"
            ),
        )

    finally:
        db.close()
