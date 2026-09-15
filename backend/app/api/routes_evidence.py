import hashlib
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..config import UPLOAD_DIR
from ..database import get_db
from ..models import EvidenceRecord
from ..services.integrity_service import attach_chain, lookup_event, lookup_officer

router = APIRouter(prefix="/evidence", tags=["evidence"])
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload")
async def upload_evidence(
    file: UploadFile = File(...),
    type: str = Form("Evidence"),
    badge_id: str = Form(None),
    event_id: str = Form(None),
    db: Session = Depends(get_db),
):
    if not file:
        raise HTTPException(status_code=400, detail="No evidence file uploaded")

    try:
        content = await file.read()
        sha256_hash = hashlib.sha256(content).hexdigest()
        timestamp = datetime.utcnow()
        stamp = timestamp.strftime("%Y%m%d_%H%M%S")
        original = file.filename or "evidence.bin"
        safe_filename = f"{stamp}_{original}"
        file_path = UPLOAD_DIR / safe_filename
        file_path.write_bytes(content)

        officer = lookup_officer(db, badge_id)
        event = lookup_event(db, event_id)
        evidence_id = f"EVD-{uuid.uuid4().hex[:10].upper()}"
        record = EvidenceRecord(
            evidence_id=evidence_id,
            recognition_event_id=event.id if event else None,
            officer_id=officer.id if officer else None,
            officer_code=badge_id,
            evidence_type=type,
            file_path=str(file_path),
            original_filename=original,
            captured_at=timestamp,
            created_at=timestamp,
            sha256_hash=sha256_hash,
            data_origin="OPERATIONAL",
        )
        attach_chain(db, record)
        db.add(record)
        db.commit()

        return {
            "success": True,
            "filename": safe_filename,
            "type": type,
            "badge_id": badge_id,
            "sha256": sha256_hash,
            "size_bytes": len(content),
            "file_path": f"/uploads/{safe_filename}",
            "evidence_id": evidence_id,
            "integrity_status": record.integrity_status,
            "message": f"{type} evidence uploaded successfully.",
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Evidence upload failed")
