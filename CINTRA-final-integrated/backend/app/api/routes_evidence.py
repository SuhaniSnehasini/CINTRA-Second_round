import hashlib
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..config import FABRIC_ENABLED
from ..models import CustodyEvent, Evidence, EvidenceRecord
from ..services.integrity_service import attach_chain, lookup_event, lookup_officer
from ..services.fabric_service import (
    FabricServiceError,
    get_fabric_history,
    record_custody_event,
)

from app.services.encryption_service import (
    decrypt_data,
    encrypt_data,
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


def _utc_now():
    return datetime.now(timezone.utc)


def _parse_timestamp(value):
    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )

        if parsed.tzinfo is None:
            parsed = parsed.replace(
                tzinfo=timezone.utc
            )

        return parsed

    except (ValueError, TypeError):
        return None


def _serialize_evidence(evidence):
    if evidence is None:
        return None

    return {
        "evidence_id": evidence.evidence_id,
        "case_id": evidence.case_id,
        "filename": evidence.filename,
        "original_filename": evidence.original_filename,
        "evidence_type": evidence.evidence_type,
        "mime_type": evidence.mime_type,
        "file_path": evidence.file_path,
        "sha256": evidence.sha256,
        "encryption": "AES-256-GCM",
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


def _serialize_event(event):
    if event is None:
        return None

    return {
        "id": event.id,
        "evidence_id": event.evidence_id,
        "action": event.action,
        "actor_badge_id": event.actor_badge_id,
        "from_custodian": event.from_custodian,
        "to_custodian": event.to_custodian,
        "reason": event.reason,
        "timestamp": (
            event.timestamp.isoformat()
            if event.timestamp
            else None
        ),
        "file_sha256": event.file_sha256,
        "blockchain_tx_id": event.blockchain_tx_id,
        "blockchain_status": event.blockchain_status,
    }


def _get_evidence(
    db: Session,
    evidence_id: str,
):
    evidence = (
        db.query(Evidence)
        .filter(
            Evidence.evidence_id == evidence_id
        )
        .first()
    )

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found.",
        )

    return evidence


def _record_local_event(
    db,
    evidence,
    action,
    actor_badge_id=None,
    from_custodian=None,
    to_custodian=None,
    reason=None,
    timestamp=None,
):
    event = CustodyEvent(
        event_id=str(uuid.uuid4()),
        evidence_id=evidence.evidence_id,
        action=action,
        actor_badge_id=actor_badge_id,
        from_custodian=from_custodian,
        to_custodian=to_custodian,
        reason=reason,
        timestamp=(
            timestamp or _utc_now()
        ),
        file_sha256=evidence.sha256,
        blockchain_status="PENDING",
    )

    db.add(event)
    db.flush()

    return event


def _record_fabric_for_event(event):
    return record_custody_event(
        evidence_id=event.evidence_id,
        event_id=event.event_id,
        action=event.action,
        actor_badge_id=event.actor_badge_id,
        from_custodian=event.from_custodian,
        to_custodian=event.to_custodian,
        reason=event.reason,
        file_sha256=event.file_sha256,
        timestamp=event.timestamp.isoformat(),
    )


def _fabric_status(error: FabricServiceError) -> str:
    """Keep local custody usable while reporting the Fabric state truthfully."""
    return "DISABLED" if not FABRIC_ENABLED else "FAILED"

# ============================================================
# UPLOAD EVIDENCE
# ============================================================

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
    Upload evidence.

    Flow:
    1. Read original evidence.
    2. Calculate SHA-256 of original evidence.
    3. Encrypt original evidence using AES-256-GCM.
    4. Store nonce + encrypted data.
    5. Register evidence in database.
    6. Create local chain-of-custody event.
    7. Record custody event on Hyperledger Fabric.
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

        # ----------------------------------------------------
        # 1. Read original evidence
        # ----------------------------------------------------

        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="Evidence file is empty.",
            )

        # ----------------------------------------------------
        # 2. SHA-256 of ORIGINAL evidence
        # ----------------------------------------------------

        file_hash = hashlib.sha256(
            content
        ).hexdigest()

        # ----------------------------------------------------
        # 3. Encrypt ORIGINAL evidence
        # ----------------------------------------------------

        nonce, encrypted_content = encrypt_data(
            content
        )

        original_filename = os.path.basename(
            file.filename
        )

        evidence_id = (
            f"EVIDENCE-{uuid.uuid4().hex[:20].upper()}"
        )

        # ----------------------------------------------------
        # 4. Store encrypted evidence
        # ----------------------------------------------------

        stored_filename = (
            f"{evidence_id}_{original_filename}.enc"
        )

        file_path = os.path.join(
            UPLOAD_DIR,
            stored_filename,
        )

        # First 12 bytes = AES-GCM nonce
        # Remaining bytes = encrypted evidence
        with open(
            file_path,
            "wb",
        ) as output:

            output.write(nonce)
            output.write(encrypted_content)

        # ----------------------------------------------------
        # Collection timestamp
        # ----------------------------------------------------

        collection_dt = _parse_timestamp(
            collection_timestamp
        )

        if collection_dt is None:
            collection_dt = _utc_now()

        # ----------------------------------------------------
        # 5. Create Evidence database record
        # ----------------------------------------------------

        evidence = Evidence(
            evidence_id=evidence_id,
            case_id=case_id,
            filename=stored_filename,
            original_filename=original_filename,
            evidence_type=type,
            mime_type=file.content_type,
            file_path=file_path,
            sha256=file_hash,
            size_bytes=len(content),
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

        # Preserve the Admin-UI branch's recognition/integrity-chain record.
        # Its file path intentionally points at the encrypted artifact, while
        # sha256_hash remains the hash of the original evidence bytes.
        officer = lookup_officer(db, badge_id)
        recognition_event = lookup_event(db, None)
        operational_record = EvidenceRecord(
            evidence_id=evidence_id,
            recognition_event_id=recognition_event.id if recognition_event else None,
            officer_id=officer.id if officer else None,
            officer_code=badge_id,
            evidence_type=type,
            file_path=file_path,
            original_filename=original_filename,
            captured_at=collection_dt,
            created_at=_utc_now(),
            sha256_hash=file_hash,
            data_origin="OPERATIONAL",
        )
        attach_chain(db, operational_record)
        db.add(operational_record)

        # ----------------------------------------------------
        # 6. Create local custody event
        # ----------------------------------------------------

        event = _record_local_event(
            db,
            evidence=evidence,
            action="REGISTERED",
            actor_badge_id=badge_id,
            from_custodian=None,
            to_custodian=badge_id,
            reason="Evidence registered.",
            timestamp=collection_dt,
        )

        # ----------------------------------------------------
        # 7. Record on Hyperledger Fabric
        # ----------------------------------------------------

        fabric_result = None

        try:

            fabric_result = _record_fabric_for_event(
                event
            )

            event.blockchain_tx_id = (
                fabric_result.get(
                    "transaction_id"
                )
            )

            event.blockchain_status = "RECORDED"

        except FabricServiceError as exc:

            event.blockchain_status = _fabric_status(exc)

            db.commit()

            return {
                "success": True,
                "local_success": True,
                "message": (
                    "Evidence was encrypted and registered locally; "
                    "Fabric custody recording is unavailable."
                ),
                "filename": stored_filename,
                "case_id": case_id,
                "type": type,
                "badge_id": badge_id,
                "sha256": file_hash,
                "size_bytes": len(content),
                "evidence": _serialize_evidence(
                    evidence
                ),
                "custody_event": _serialize_event(
                    event
                ),
                "blockchain_status": event.blockchain_status,
                "blockchain_error": str(exc),
                "encryption": "AES-256-GCM",
            }

        # ----------------------------------------------------
        # Save everything
        # ----------------------------------------------------

        db.commit()

        # ----------------------------------------------------
        # Final response
        # ----------------------------------------------------

        return {
            "success": True,

            "message": (
                "Evidence uploaded, encrypted, "
                "and registered successfully."
            ),

            # Encryption information
            "filename": stored_filename,
            "case_id": case_id,
            "type": type,
            "badge_id": badge_id,
            "sha256": file_hash,
            "size_bytes": len(content),
            "evidence": _serialize_evidence(
                evidence
            ),
            "custody_event": _serialize_event(
                event
            ),
            "blockchain_status": event.blockchain_status,
            "blockchain_tx_id": event.blockchain_tx_id,
            "encryption": "AES-256-GCM",
        }
    finally:
        db.close()


@router.get("/{evidence_id}/custody")
async def get_custody_history(evidence_id: str):
    """Fetch complete chain of custody history for an evidence item."""
    db = SessionLocal()
    try:
        evidence = _get_evidence(db, evidence_id)
        events = (
            db.query(CustodyEvent)
            .filter(CustodyEvent.evidence_id == evidence_id)
            .order_by(CustodyEvent.timestamp.asc())
            .all()
        )
        return {
            "success": True,
            "evidence_id": evidence.evidence_id,
            "status": evidence.status,
            "current_custodian": evidence.current_custodian,
            "events": [_serialize_event(e) for e in events],
            "evidence": _serialize_evidence(evidence),
        }
    finally:
        db.close()


@router.post("/{evidence_id}/transfer")
async def transfer_evidence_custody(
    evidence_id: str,
    badge_id: str = Form(...),
    to_custodian: str = Form(...),
    reason: str | None = Form(None),
):
    """Transfer evidence custody to a new officer or lab custodian."""
    db = SessionLocal()
    try:
        evidence = _get_evidence(db, evidence_id)
        from_custodian = evidence.current_custodian
        evidence.current_custodian = to_custodian
        evidence.updated_at = _utc_now()

        event = _record_local_event(
            db,
            evidence=evidence,
            action="TRANSFERRED",
            actor_badge_id=badge_id,
            from_custodian=from_custodian,
            to_custodian=to_custodian,
            reason=reason or "Custody transfer.",
        )

        try:
            fabric_res = _record_fabric_for_event(event)
            event.blockchain_tx_id = fabric_res.get("transaction_id")
            event.blockchain_status = "RECORDED"
        except FabricServiceError as exc:
            event.blockchain_status = _fabric_status(exc)

        db.commit()

        return {
            "success": True,
            "message": f"Custody of evidence {evidence_id} transferred to {to_custodian}.",
            "evidence": _serialize_evidence(evidence),
            "custody_event": _serialize_event(event),
            "transaction_id": event.blockchain_tx_id,
        }
    finally:
        db.close()