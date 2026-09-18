from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import SuspectResponse
from ..services.suspect_service import get_suspect, list_suspects

router = APIRouter(prefix="/suspects", tags=["suspects"])

def _public_suspect(suspect):
    if not suspect:
        return None
    return {
        "suspect_id": getattr(suspect, "suspect_code", ""),
        "name": getattr(suspect, "name", ""),
        "role": getattr(suspect, "role", ""),
        "wanted": getattr(suspect, "wanted", False),
        "enrollment_status": getattr(suspect, "enrollment_status", "REAL_ENROLLMENT"),
        "enrollment_date": (
            suspect.enrollment_date.isoformat() + "Z"
            if getattr(suspect, "enrollment_date", None)
            else None
        ),
        "created_at": (
            suspect.created_at.isoformat() + "Z"
            if getattr(suspect, "created_at", None)
            else None
        ),
        "updated_at": (
            suspect.updated_at.isoformat() + "Z"
            if getattr(suspect, "updated_at", None)
            else None
        ),
        "data_origin": getattr(suspect, "data_origin", "OPERATIONAL"),
        "alias": getattr(suspect, "alias", None),
        "fir_number": getattr(suspect, "fir_number", None),
        "offence_category": getattr(suspect, "offence_category", None),
    }

@router.get("", response_model=list[SuspectResponse])
def read_suspects(db: Session = Depends(get_db)):
    return [_public_suspect(suspect) for suspect in list_suspects(db)]

@router.get("/{suspect_code}", response_model=SuspectResponse)
def read_suspect(suspect_code: str, db: Session = Depends(get_db)):
    suspect = get_suspect(db, suspect_code)
    if not suspect:
        raise HTTPException(status_code=404, detail="Suspect not found")
    return _public_suspect(suspect)
