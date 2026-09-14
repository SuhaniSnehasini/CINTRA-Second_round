import hashlib
import os
import uuid
from datetime import datetime

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
    tags=["evidence"],
)


UPLOAD_DIR = os.path.join(
    os.path.dirname(
        os.path.dirname(
            os.path.dirname(__file__)
        )
    ),
    "uploads",
)

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True,
)


def generate_evidence_id() -> str:
    """
    Generates a human-readable unique evidence ID.

    Example:
        EV-20260913-A1B2C3D4
    """

    timestamp = datetime.utcnow().strftime("%Y%m%d")
    unique_part = uuid.uuid4().hex[:8].upper()

    return f"EV-{timestamp}-{unique_part}"


def generate_event_id() -> str:
    """
    Generates a unique custody event ID.
    """

    return f"CE-{uuid.uuid4().hex.upper()}"


def get_blockchain_status(
    events: list[CustodyEvent],
) -> str:
    """
    Determine the overall blockchain status of an
    evidence item from its custody events.

    Possible results:

        RECORDED
        PARTIAL
        NOT_RECORDED
    """

    if not events:
        return "NOT_RECORDED"

    statuses = {
        event.blockchain_status
        for event in events
    }

    if statuses == {"RECORDED"}:
        return "RECORDED"

    if "RECORDED" in statuses:
        return "PARTIAL"

    return "NOT_RECORDED"


def update_event_from_fabric(
    db: Session,
    event: CustodyEvent,
    fabric_response: dict,
) -> None:
    """
    Update a local SQLite custody event after Fabric
    successfully records it.
    """

    transaction_id = fabric_response.get(
        "transaction_id"
    )

    if not transaction_id:
        raise FabricServiceError(
            "Fabric response did not contain a transaction ID."
        )

    event.blockchain_tx_id = transaction_id
    event.blockchain_status = "RECORDED"

    db.commit()


def record_event_on_fabric(
    db: Session,
    event: CustodyEvent,
) -> dict:
    """
    Send a custody event to the Fabric Gateway.

    If successful, update the SQLite event with:
        blockchain_tx_id
        blockchain_status = RECORDED

    If Fabric fails, the SQLite event remains:
        blockchain_status = NOT_RECORDED
    """

    fabric_response = record_custody_event(
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

    update_event_from_fabric(
        db=db,
        event=event,
        fabric_response=fabric_response,
    )

    return fabric_response


def synchronize_event_from_fabric(
    db: Session,
    event: CustodyEvent,
    fabric_event: dict,
) -> bool:
    """
    Synchronize one local custody event with an event
    that already exists on Hyperledger Fabric.

    Returns True if the local event was updated.
    Returns False if the Fabric event does not contain
    enough information to synchronize safely.
    """

    fabric_event_id = fabric_event.get(
        "eventId"
    )

    if fabric_event_id != event.event_id:
        return False

    transaction_id = fabric_event.get(
        "blockchainTxId"
    )

    if not transaction_id:
        return False

    fabric_evidence_id = fabric_event.get(
        "evidenceId"
    )

    if fabric_evidence_id != event.evidence_id:
        return False

    fabric_sha256 = fabric_event.get(
        "fileSha256"
    )

    if fabric_sha256:
        if (
            fabric_sha256.lower()
            != event.file_sha256.lower()
        ):
            raise FabricServiceError(
                "Fabric event hash does not match "
                f"the local evidence event {event.event_id}."
            )

    event.blockchain_tx_id = transaction_id
    event.blockchain_status = "RECORDED"

    return True


@router.post("/upload")
async def upload_evidence(
    file: UploadFile = File(...),
    type: str = Form("Evidence"),
    badge_id: str | None = Form(None),
    case_id: str | None = Form(None),
):
    """
    Upload evidence and create the first Chain of Custody event.

    Flow:

        Upload
          ↓
        SHA-256
          ↓
        Save file
          ↓
        Create Evidence record
          ↓
        Create REGISTERED event
          ↓
        Commit SQLite
          ↓
        Send REGISTERED event to Fabric
          ↓
        Save Fabric transaction ID
    """

    if not file:
        raise HTTPException(
            status_code=400,
            detail="No evidence file uploaded.",
        )

    db: Session = SessionLocal()

    file_path = None

    try:
        # --------------------------------------------------
        # 1. Read uploaded file
        # --------------------------------------------------

        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The uploaded evidence file is empty.",
            )

        # --------------------------------------------------
        # 2. Calculate SHA-256
        # --------------------------------------------------

        sha256_hash = hashlib.sha256(
            content
        ).hexdigest()

        # --------------------------------------------------
        # 3. Generate unique Evidence ID
        # --------------------------------------------------

        evidence_id = generate_evidence_id()

        # --------------------------------------------------
        # 4. Generate safe server-side filename
        # --------------------------------------------------

        original_filename = (
            file.filename
            or "evidence_file"
        )

        safe_original_filename = os.path.basename(
            original_filename
        )

        unique_filename = (
            f"{evidence_id}_{safe_original_filename}"
        )

        file_path = os.path.join(
            UPLOAD_DIR,
            unique_filename,
        )

        # --------------------------------------------------
        # 5. Save evidence file
        # --------------------------------------------------

        with open(
            file_path,
            "wb",
        ) as evidence_file:
            evidence_file.write(content)

        # --------------------------------------------------
        # 6. Create Evidence record
        # --------------------------------------------------

        now = datetime.utcnow()

        evidence = Evidence(
            evidence_id=evidence_id,
            case_id=case_id,
            filename=unique_filename,
            original_filename=safe_original_filename,
            evidence_type=type,
            mime_type=file.content_type,
            file_path=file_path,
            sha256=sha256_hash,
            size_bytes=len(content),
            original_badge_id=badge_id,
            current_custodian=badge_id,
            status="IN_CUSTODY",
            registered_at=now,
            updated_at=now,
        )

        db.add(evidence)

        # --------------------------------------------------
        # 7. Create REGISTERED custody event
        # --------------------------------------------------

        registration_event = CustodyEvent(
            event_id=generate_event_id(),
            evidence_id=evidence_id,
            action="REGISTERED",
            actor_badge_id=badge_id,
            from_custodian=None,
            to_custodian=badge_id,
            reason="Evidence uploaded and registered in CINTRA.",
            file_sha256=sha256_hash,
            timestamp=now,
            blockchain_tx_id=None,
            blockchain_status="NOT_RECORDED",
        )

        db.add(registration_event)

        # --------------------------------------------------
        # 8. Commit local database first
        # --------------------------------------------------

        db.commit()

        # --------------------------------------------------
        # 9. Record the event on Hyperledger Fabric
        # --------------------------------------------------

        try:
            fabric_response = record_event_on_fabric(
                db=db,
                event=registration_event,
            )

            blockchain_status = "RECORDED"
            blockchain_tx_id = fabric_response.get(
                "transaction_id"
            )

        except FabricServiceError as fabric_error:
            blockchain_status = "NOT_RECORDED"
            blockchain_tx_id = None

            return {
                "success": True,
                "evidence_id": evidence_id,
                "filename": unique_filename,
                "original_filename": safe_original_filename,
                "type": type,
                "mime_type": file.content_type,
                "badge_id": badge_id,
                "case_id": case_id,
                "sha256": sha256_hash,
                "size_bytes": len(content),
                "file_path": f"/uploads/{unique_filename}",
                "status": "IN_CUSTODY",
                "custody_event": {
                    "event_id": registration_event.event_id,
                    "action": "REGISTERED",
                    "actor_badge_id": badge_id,
                    "timestamp": now.isoformat(),
                    "blockchain_tx_id": blockchain_tx_id,
                    "blockchain_status": blockchain_status,
                },
                "blockchain_status": blockchain_status,
                "blockchain_error": str(fabric_error),
                "message": (
                    f"{type} evidence uploaded successfully, "
                    "but the blockchain transaction could not "
                    "be recorded. The custody event remains "
                    "available in SQLite for reconciliation."
                ),
            }

        # --------------------------------------------------
        # 10. Return successful response
        # --------------------------------------------------

        return {
            "success": True,
            "evidence_id": evidence_id,
            "filename": unique_filename,
            "original_filename": safe_original_filename,
            "type": type,
            "mime_type": file.content_type,
            "badge_id": badge_id,
            "case_id": case_id,
            "sha256": sha256_hash,
            "size_bytes": len(content),
            "file_path": f"/uploads/{unique_filename}",
            "status": "IN_CUSTODY",
            "custody_event": {
                "event_id": registration_event.event_id,
                "action": "REGISTERED",
                "actor_badge_id": badge_id,
                "timestamp": now.isoformat(),
                "blockchain_tx_id": blockchain_tx_id,
                "blockchain_status": blockchain_status,
            },
            "blockchain_status": blockchain_status,
            "message": (
                f"{type} evidence uploaded and registered "
                "in the Chain of Custody and Hyperledger Fabric."
            ),
        }

    except HTTPException:
        db.rollback()

        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass

        raise

    except Exception as exc:
        db.rollback()

        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass

        raise HTTPException(
            status_code=500,
            detail=(
                "Evidence upload failed: "
                f"{str(exc)}"
            ),
        )

    finally:
        db.close()


@router.get("/{evidence_id}")
def get_evidence(
    evidence_id: str,
):
    """
    Retrieve metadata for one evidence item.
    """

    db: Session = SessionLocal()

    try:
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
                detail=(
                    f"Evidence '{evidence_id}' "
                    "was not found."
                ),
            )

        events = (
            db.query(CustodyEvent)
            .filter(
                CustodyEvent.evidence_id
                == evidence_id
            )
            .all()
        )

        blockchain_status = get_blockchain_status(
            events
        )

        latest_blockchain_tx = None

        for event in sorted(
            events,
            key=lambda item: (
                item.timestamp,
                item.id,
            ),
            reverse=True,
        ):
            if event.blockchain_tx_id:
                latest_blockchain_tx = (
                    event.blockchain_tx_id
                )
                break

        return {
            "success": True,
            "evidence": {
                "evidence_id": evidence.evidence_id,
                "case_id": evidence.case_id,
                "filename": evidence.filename,
                "original_filename": evidence.original_filename,
                "evidence_type": evidence.evidence_type,
                "mime_type": evidence.mime_type,
                "file_path": f"/uploads/{evidence.filename}",
                "sha256": evidence.sha256,
                "size_bytes": evidence.size_bytes,
                "original_badge_id": evidence.original_badge_id,
                "current_custodian": evidence.current_custodian,
                "status": evidence.status,
                "registered_at": evidence.registered_at.isoformat(),
                "blockchain_status": blockchain_status,
                "latest_blockchain_tx_id": latest_blockchain_tx,
            },
        }

    finally:
        db.close()


@router.get("/{evidence_id}/custody")
def get_custody_history(
    evidence_id: str,
):
    """
    Return the complete Chain of Custody history
    for an evidence item from the local database.
    """

    db: Session = SessionLocal()

    try:
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
                detail=(
                    f"Evidence '{evidence_id}' "
                    "was not found."
                ),
            )

        events = (
            db.query(CustodyEvent)
            .filter(
                CustodyEvent.evidence_id
                == evidence_id
            )
            .order_by(
                CustodyEvent.timestamp.asc(),
                CustodyEvent.id.asc(),
            )
            .all()
        )

        blockchain_status = get_blockchain_status(
            events
        )

        return {
            "success": True,

            "evidence": {
                "evidence_id": evidence.evidence_id,
                "case_id": evidence.case_id,
                "filename": evidence.filename,
                "original_filename": evidence.original_filename,
                "evidence_type": evidence.evidence_type,
                "mime_type": evidence.mime_type,
                "file_path": f"/uploads/{evidence.filename}",
                "sha256": evidence.sha256,
                "size_bytes": evidence.size_bytes,
                "original_badge_id": evidence.original_badge_id,
                "current_custodian": evidence.current_custodian,
                "status": evidence.status,
                "registered_at": evidence.registered_at.isoformat(),
                "blockchain_status": blockchain_status,
            },

            "events": [
                {
                    "event_id": event.event_id,
                    "evidence_id": event.evidence_id,
                    "action": event.action,
                    "actor_badge_id": event.actor_badge_id,
                    "from_custodian": event.from_custodian,
                    "to_custodian": event.to_custodian,
                    "reason": event.reason,
                    "file_sha256": event.file_sha256,
                    "timestamp": event.timestamp.isoformat(),
                    "blockchain_tx_id": event.blockchain_tx_id,
                    "blockchain_status": event.blockchain_status,
                }
                for event in events
            ],
        }

    finally:
        db.close()


@router.post("/{evidence_id}/reconcile")
def reconcile_evidence_blockchain(
    evidence_id: str,
):
    """
    Reconcile the local SQLite custody history with
    the custody history already recorded on Fabric.

    This endpoint NEVER creates a new blockchain event.

    It only reads Fabric history and updates matching
    local events with their blockchain transaction IDs
    and RECORDED status.

    This is especially useful when:
        - Fabric recorded an event successfully
        - but SQLite did not receive the transaction ID
        - or Fabric was temporarily unavailable
        - or the application needs to repair local state
    """

    db: Session = SessionLocal()

    try:
        # --------------------------------------------------
        # 1. Verify local evidence exists
        # --------------------------------------------------

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
                detail=(
                    f"Evidence '{evidence_id}' "
                    "was not found."
                ),
            )

        # --------------------------------------------------
        # 2. Get local custody events
        # --------------------------------------------------

        local_events = (
            db.query(CustodyEvent)
            .filter(
                CustodyEvent.evidence_id
                == evidence_id
            )
            .order_by(
                CustodyEvent.timestamp.asc(),
                CustodyEvent.id.asc(),
            )
            .all()
        )

        # --------------------------------------------------
        # 3. Ask Fabric for the authoritative history
        # --------------------------------------------------

        try:
            fabric_response = get_fabric_history(
                evidence_id
            )

        except FabricServiceError as fabric_error:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Unable to retrieve blockchain history "
                    f"for evidence '{evidence_id}': "
                    f"{str(fabric_error)}"
                ),
            )

        fabric_events = fabric_response.get(
            "events",
            [],
        )

        if not isinstance(
            fabric_events,
            list,
        ):
            raise HTTPException(
                status_code=502,
                detail=(
                    "Fabric Gateway returned an invalid "
                    "custody history format."
                ),
            )

        # --------------------------------------------------
        # 4. Build Fabric event lookup
        # --------------------------------------------------

        fabric_events_by_id = {}

        for fabric_event in fabric_events:
            if not isinstance(
                fabric_event,
                dict,
            ):
                continue

            event_id = fabric_event.get(
                "eventId"
            )

            if event_id:
                fabric_events_by_id[
                    event_id
                ] = fabric_event

        # --------------------------------------------------
        # 5. Synchronize matching local events
        # --------------------------------------------------

        synchronized_events = []
        already_recorded_events = []
        unmatched_local_events = []

        for local_event in local_events:

            fabric_event = fabric_events_by_id.get(
                local_event.event_id
            )

            if not fabric_event:
                unmatched_local_events.append(
                    local_event.event_id
                )
                continue

            was_already_recorded = (
                local_event.blockchain_status
                == "RECORDED"
                and bool(
                    local_event.blockchain_tx_id
                )
            )

            updated = synchronize_event_from_fabric(
                db=db,
                event=local_event,
                fabric_event=fabric_event,
            )

            if updated:

                if was_already_recorded:
                    already_recorded_events.append(
                        {
                            "event_id": local_event.event_id,
                            "blockchain_tx_id":
                                local_event.blockchain_tx_id,
                            "blockchain_status":
                                local_event.blockchain_status,
                        }
                    )

                else:
                    synchronized_events.append(
                        {
                            "event_id": local_event.event_id,
                            "action": local_event.action,
                            "blockchain_tx_id":
                                local_event.blockchain_tx_id,
                            "blockchain_status":
                                local_event.blockchain_status,
                        }
                    )

        # --------------------------------------------------
        # 6. Commit synchronized state
        # --------------------------------------------------

        db.commit()

        # --------------------------------------------------
        # 7. Calculate final local blockchain status
        # --------------------------------------------------

        refreshed_events = (
            db.query(CustodyEvent)
            .filter(
                CustodyEvent.evidence_id
                == evidence_id
            )
            .order_by(
                CustodyEvent.timestamp.asc(),
                CustodyEvent.id.asc(),
            )
            .all()
        )

        blockchain_status = get_blockchain_status(
            refreshed_events
        )

        return {
            "success": True,
            "evidence_id": evidence_id,
            "blockchain_status": blockchain_status,
            "fabric_event_count": len(
                fabric_events
            ),
            "local_event_count": len(
                refreshed_events
            ),
            "synchronized_events":
                synchronized_events,
            "already_recorded_events":
                already_recorded_events,
            "unmatched_local_event_ids":
                unmatched_local_events,
            "message": (
                "Blockchain reconciliation completed successfully."
            ),
        }

    except HTTPException:
        db.rollback()
        raise

    except FabricServiceError as fabric_error:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=str(fabric_error),
        )

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Blockchain reconciliation failed: "
                f"{str(exc)}"
            ),
        )

    finally:
        db.close()


@router.post("/{evidence_id}/transfer")
def transfer_evidence(
    evidence_id: str,
    from_badge_id: str = Form(...),
    to_badge_id: str = Form(...),
    reason: str = Form("Evidence custody transfer."),
):
    """
    Transfer evidence from one officer to another.

    Flow:

        Validate custody
          ↓
        Create SQLite event
          ↓
        Commit local event
          ↓
        Record event on Fabric
          ↓
        Save Fabric transaction ID
    """

    if from_badge_id == to_badge_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "The source and destination "
                "officers must be different."
            ),
        )

    db: Session = SessionLocal()

    try:
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
                detail=(
                    f"Evidence '{evidence_id}' "
                    "was not found."
                ),
            )

        if (
            evidence.current_custodian
            and evidence.current_custodian
            != from_badge_id
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Custody transfer rejected. "
                    f"Current custodian is "
                    f"{evidence.current_custodian}."
                ),
            )

        now = datetime.utcnow()

        event = CustodyEvent(
            event_id=generate_event_id(),
            evidence_id=evidence_id,
            action="TRANSFERRED",
            actor_badge_id=from_badge_id,
            from_custodian=from_badge_id,
            to_custodian=to_badge_id,
            reason=reason,
            file_sha256=evidence.sha256,
            timestamp=now,
            blockchain_tx_id=None,
            blockchain_status="NOT_RECORDED",
        )

        evidence.current_custodian = to_badge_id
        evidence.updated_at = now

        db.add(event)

        # --------------------------------------------------
        # Commit local transfer
        # --------------------------------------------------

        db.commit()

        # --------------------------------------------------
        # Record transfer on Fabric
        # --------------------------------------------------

        try:
            fabric_response = record_event_on_fabric(
                db=db,
                event=event,
            )

            blockchain_status = "RECORDED"
            blockchain_tx_id = fabric_response.get(
                "transaction_id"
            )

        except FabricServiceError as fabric_error:

            return {
                "success": True,
                "evidence_id": evidence_id,
                "action": "TRANSFERRED",
                "from_custodian": from_badge_id,
                "to_custodian": to_badge_id,
                "timestamp": now.isoformat(),
                "event_id": event.event_id,
                "blockchain_tx_id": None,
                "blockchain_status": "NOT_RECORDED",
                "blockchain_error": str(fabric_error),
                "message": (
                    "Evidence custody was transferred locally, "
                    "but the blockchain transaction could not "
                    "be recorded. The event remains available "
                    "for reconciliation."
                ),
            }

        return {
            "success": True,
            "evidence_id": evidence_id,
            "action": "TRANSFERRED",
            "from_custodian": from_badge_id,
            "to_custodian": to_badge_id,
            "timestamp": now.isoformat(),
            "event_id": event.event_id,
            "blockchain_tx_id": blockchain_tx_id,
            "blockchain_status": blockchain_status,
            "message": (
                "Evidence custody transferred successfully "
                "and recorded on Hyperledger Fabric."
            ),
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Custody transfer failed: "
                f"{str(exc)}"
            ),
        )

    finally:
        db.close()


@router.post("/{evidence_id}/access")
def record_evidence_access(
    evidence_id: str,
    badge_id: str = Form(...),
):
    """
    Record that an officer accessed an evidence item.

    The access event is stored locally and then recorded
    on Hyperledger Fabric.
    """

    db: Session = SessionLocal()

    try:
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
                detail=(
                    f"Evidence '{evidence_id}' "
                    "was not found."
                ),
            )

        now = datetime.utcnow()

        event = CustodyEvent(
            event_id=generate_event_id(),
            evidence_id=evidence_id,
            action="ACCESSED",
            actor_badge_id=badge_id,
            from_custodian=None,
            to_custodian=None,
            reason="Evidence accessed by authorized officer.",
            file_sha256=evidence.sha256,
            timestamp=now,
            blockchain_tx_id=None,
            blockchain_status="NOT_RECORDED",
        )

        db.add(event)

        # --------------------------------------------------
        # Commit local access event
        # --------------------------------------------------

        db.commit()

        # --------------------------------------------------
        # Record access event on Fabric
        # --------------------------------------------------

        try:
            fabric_response = record_event_on_fabric(
                db=db,
                event=event,
            )

            blockchain_status = "RECORDED"
            blockchain_tx_id = fabric_response.get(
                "transaction_id"
            )

        except FabricServiceError as fabric_error:

            return {
                "success": True,
                "evidence_id": evidence_id,
                "action": "ACCESSED",
                "actor_badge_id": badge_id,
                "timestamp": now.isoformat(),
                "event_id": event.event_id,
                "blockchain_tx_id": None,
                "blockchain_status": "NOT_RECORDED",
                "blockchain_error": str(fabric_error),
                "message": (
                    "Evidence access was recorded locally, "
                    "but the blockchain transaction could not "
                    "be recorded. The event remains available "
                    "for reconciliation."
                ),
            }

        return {
            "success": True,
            "evidence_id": evidence_id,
            "action": "ACCESSED",
            "actor_badge_id": badge_id,
            "timestamp": now.isoformat(),
            "event_id": event.event_id,
            "blockchain_tx_id": blockchain_tx_id,
            "blockchain_status": blockchain_status,
            "message": (
                "Evidence access recorded successfully "
                "and written to Hyperledger Fabric."
            ),
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Evidence access logging failed: "
                f"{str(exc)}"
            ),
        )

    finally:
        db.close()


@router.post("/{evidence_id}/verify")
def verify_evidence_integrity(
    evidence_id: str,
):
    """
    Recalculate SHA-256 from the stored evidence file
    and compare it with the originally registered hash.
    """

    db: Session = SessionLocal()

    try:
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
                detail=(
                    f"Evidence '{evidence_id}' "
                    "was not found."
                ),
            )

        if not os.path.exists(evidence.file_path):
            raise HTTPException(
                status_code=404,
                detail=(
                    "The original evidence file "
                    "could not be found on the server."
                ),
            )

        hasher = hashlib.sha256()

        with open(
            evidence.file_path,
            "rb",
        ) as stored_file:
            while True:
                chunk = stored_file.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                hasher.update(chunk)

        current_hash = hasher.hexdigest()

        verified = (
            current_hash.lower()
            == evidence.sha256.lower()
        )

        return {
            "success": True,
            "evidence_id": evidence_id,
            "stored_sha256": evidence.sha256,
            "current_sha256": current_hash,
            "verified": verified,
            "message": (
                "Evidence integrity verified. "
                "The file matches the registered SHA-256 hash."
                if verified
                else
                "WARNING: Evidence integrity verification failed. "
                "The current file does not match the registered SHA-256 hash."
            ),
        }

    finally:
        db.close()