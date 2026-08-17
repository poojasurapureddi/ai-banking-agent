from sqlalchemy.orm import Session
import json
from typing import Optional, Any
from app.models import AuditLog

def log_action(
    db: Session,
    user_id: Optional[int],
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    details: Optional[Any] = None
) -> AuditLog:
    if details is not None:
        if isinstance(details, (dict, list)):
            details_str = json.dumps(details)
        else:
            details_str = str(details)
    else:
        details_str = None

    db_log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details_str
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log
