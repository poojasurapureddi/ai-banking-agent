import time
from dataclasses import dataclass
from threading import Lock
from typing import Dict, Optional

# In-memory pending-transfer store, keyed by user_id.
# Single-process only (see architectural note) — sufficient for this app's
# single uvicorn worker in dev mode; a DB-backed table would be the
# production upgrade path.
PENDING_TTL_SECONDS = 300  # 5 minutes

@dataclass
class PendingTransfer:
    user_id: int
    source_account_id: int
    beneficiary_id: int
    beneficiary_name: str
    beneficiary_account_number: str
    amount: float
    created_at: float

_store: Dict[int, PendingTransfer] = {}
_lock = Lock()

def set_pending(user_id: int, pt: PendingTransfer) -> None:
    with _lock:
        _store[user_id] = pt

def get_pending(user_id: int) -> Optional[PendingTransfer]:
    with _lock:
        pt = _store.get(user_id)
        if pt and (time.time() - pt.created_at) > PENDING_TTL_SECONDS:
            del _store[user_id]
            return None
        return pt

def clear_pending(user_id: int) -> None:
    with _lock:
        _store.pop(user_id, None)