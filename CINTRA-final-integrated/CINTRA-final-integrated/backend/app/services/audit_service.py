import json
from datetime import datetime
from sqlalchemy.orm import Session
from ..models import AdminAuditLog


def write_audit(
    db: Session,
    *,
    admin_id: int | None,
    action: str,
    resource_type: str,
    resource_id: str | None,
    result: str,
    metadata: dict | None = None,
) -> AdminAuditLog:
    entry = AdminAuditLog(
        admin_id=admin_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        timestamp=datetime.utcnow(),
        result=result,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(entry)
    db.flush()
    return entry
