from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Account, Transaction, TransactionType, TransactionStatus
from app.schemas import DepositRequest, WithdrawRequest, TransferRequest, TransactionResponse, TransactionWithAccountResponse
from app.services.auth import get_current_user
from app.services.banking import deposit_money, withdraw_money, create_transfer_request

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.post("/deposit", response_model=TransactionResponse)
def deposit(req: DepositRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Guardrails: amount must be > 0 (handled by Pydantic gt=0, but double-checked)
    if req.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be positive")
    return deposit_money(db, req.account_id, req.amount, current_user.id)

@router.post("/withdraw", response_model=TransactionResponse)
def withdraw(req: WithdrawRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be positive")
    return withdraw_money(db, req.account_id, req.amount, current_user.id)

@router.post("/transfer")
def transfer(req: TransferRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be positive")

    # We call the banking service, which will handle risks and raise MediumRiskConfirmationRequired or return transaction details.
    txn, risk_level = create_transfer_request(
        db=db,
        account_id=req.account_id,
        beneficiary_account_number=req.beneficiary_account_number,
        amount=req.amount,
        user_id=current_user.id,
        confirmed=req.confirmed
    )

    # Format and return standard status report
    return {
        "id": txn.id,
        "account_id": txn.account_id,
        "beneficiary_id": txn.beneficiary_id,
        "type": txn.type,
        "amount": txn.amount,
        "status": txn.status,
        "risk_score": txn.risk_score,
        "risk_reason": txn.risk_reason,
        "created_at": txn.created_at,
        "risk_level": risk_level
    }

@router.get("", response_model=List[TransactionWithAccountResponse])
def list_transactions(
    search: Optional[str] = Query(None, description="Search by transaction ID, e.g. 'TXN-1002', '1002', or '1002'"),
    type: Optional[TransactionType] = Query(None, description="Filter by transaction type"),
    status_filter: Optional[TransactionStatus] = Query(None, alias="status", description="Filter by transaction status"),
    account_id: Optional[int] = Query(None, description="Filter to a single account"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists transactions across all accounts owned by the authenticated user
    (or a single account if account_id is provided and owned by the user).
    Ownership is always enforced server-side via current_user.id, regardless
    of any account_id supplied by the client.
    """
    owned_account_ids_query = db.query(Account.id).filter(Account.user_id == current_user.id)

    if account_id is not None:
        # Restrict to this account only if it actually belongs to the user
        owned_account_ids_query = owned_account_ids_query.filter(Account.id == account_id)

    owned_account_ids = [row[0] for row in owned_account_ids_query.all()]
    if not owned_account_ids:
        return []

    query = db.query(Transaction).filter(Transaction.account_id.in_(owned_account_ids))

    if type is not None:
        query = query.filter(Transaction.type == type)

    if status_filter is not None:
        query = query.filter(Transaction.status == status_filter)

    if search:
        # Accept "TXN-123", "123", or similar input; extract digits and match by ID
        digits = "".join(ch for ch in search if ch.isdigit())
        if digits:
            query = query.filter(Transaction.id == int(digits))
        else:
            # No numeric content in the search — no transaction can match by ID
            return []

    transactions = (
        query.order_by(Transaction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    # Attach account_number for display without a second round trip from the frontend
    result = []
    for txn in transactions:
        result.append(
            TransactionWithAccountResponse(
                id=txn.id,
                account_id=txn.account_id,
                beneficiary_id=txn.beneficiary_id,
                type=txn.type,
                amount=txn.amount,
                status=txn.status,
                risk_score=txn.risk_score,
                risk_reason=txn.risk_reason,
                created_at=txn.created_at,
                account_number=txn.account.account_number
            )
        )
    return result