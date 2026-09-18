from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AdminAccount, AdminSession
from ..services.admin_auth_service import AdminAuthError, get_session_by_token

bearer = HTTPBearer(auto_error=False)

ROLE_RANK = {"AUDITOR": 1, "ADMIN": 2, "SUPER_ADMIN": 3}

READ_ACTIONS = {
    "VIEW_OFFICER",
    "VIEW_PERSON",
    "VIEW_RECOGNITION",
    "VIEW_EVIDENCE",
    "VIEW_AUDIT_LOG",
    "VIEW_INVESTIGATION",
    "VIEW_INTEGRITY",
    "VIEW_ANALYTICS",
    "VIEW_SYSTEM",
    "VIEW_SETTINGS",
    "VIEW_ADMIN",
}

WRITE_ADMIN = {
    "CREATE_OFFICER",
    "DISABLE_OFFICER",
    "UPDATE_OFFICER",
    "CREATE_PERSON",
    "UPDATE_PERSON",
    "VERIFY_EVIDENCE",
    "EXPORT_REPORT",
}

SUPER_ONLY = {"CREATE_ADMIN", "DISABLE_ADMIN", "CHANGE_ROLE", "CHANGE_SETTING", "MANAGE_ADMINS"}


def permission_for(role: str, action: str) -> bool:
    if role == "SUPER_ADMIN":
        return True
    if role == "ADMIN":
        return action not in SUPER_ONLY
    if role == "AUDITOR":
        return action in READ_ACTIONS or action in {"VIEW_ADMIN"}
    return False


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> tuple[AdminAccount, AdminSession, Session]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required.")
    try:
        session, admin = get_session_by_token(db, credentials.credentials)
    except AdminAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return admin, session, db


def require_permission(action: str):
    def _inner(ctx=Depends(require_admin)):
        admin, session, db = ctx
        if not permission_for(admin.role, action):
            raise HTTPException(status_code=403, detail="Insufficient administrator privileges.")
        return admin, session, db

    return _inner
