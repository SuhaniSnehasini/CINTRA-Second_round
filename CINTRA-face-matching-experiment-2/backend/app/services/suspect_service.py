from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session
from ..models import Suspect

def list_suspects(db: Session):
    return list(db.scalars(select(Suspect).where(Suspect.active.is_(True)).order_by(Suspect.suspect_code)))

def get_suspect(db: Session, suspect_code: str):
    code_clean = suspect_code.strip()
    if not code_clean:
        return None

    # 1. Exact match on suspect_code
    exact = db.scalar(select(Suspect).where(Suspect.suspect_code == code_clean, Suspect.active.is_(True)))
    if exact:
        return exact

    # 2. Case-insensitive match on suspect_code
    ci_code = db.scalar(
        select(Suspect).where(
            func.lower(Suspect.suspect_code) == code_clean.lower(),
            Suspect.active.is_(True)
        )
    )
    if ci_code:
        return ci_code

    # 3. Search by name, role, or partial suspect_code
    search_pattern = f"%{code_clean}%"
    return db.scalar(
        select(Suspect).where(
            Suspect.active.is_(True),
            or_(
                Suspect.suspect_code.ilike(search_pattern),
                Suspect.name.ilike(search_pattern),
                Suspect.role.ilike(search_pattern)
            )
        ).order_by(Suspect.suspect_code)
    )

