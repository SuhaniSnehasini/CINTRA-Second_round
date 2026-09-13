from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import SuspectResponse
from ..services.suspect_service import get_suspect, list_suspects

router = APIRouter(prefix="/suspects", tags=["suspects"])

def _public_suspect(suspect):
    return {
        "suspect_id": suspect.suspect_code,
        "name": suspect.name,
        "role": suspect.role,
        "wanted": suspect.wanted,
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
