import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models import Account, Beneficiary, Transaction, TransactionType, TransactionStatus, ReviewRequest, ReviewStatus, UserRole
from app.services.risk import calculate_risk, get_risk_level
from app.services.audit import log_action

class MediumRiskConfirmationRequired(HTTPException):
    def __init__(self, risk_score: int, reasons: list[str]):
        super().__init__(
            status_code=status.HTTP_200_OK,  # Send 200 with custom payload for confirmation
            detail={
                "status": "confirmation_required",
                "risk_score": risk_score,
                "risk_level": "MEDIUM",
                "reasons": reasons,
                "message": "This transaction has medium risk and requires confirmation."
            }
        )

def deposit_money(db: Session, account_id: int, amount: float, user_id: int) -> Transaction:
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        
    if account.user_id != user_id:
        # Check if user is Admin, otherwise deny
        # For simplicity, we assume ownership or Admin
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    if amount > 1_000_000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deposits are limited to ₹10,00,000 per transaction. Please contact your branch for larger deposits."
        )

    # Update account balance
    account.balance += amount
    db.add(account)

    # Create transaction
    txn = Transaction(
        account_id=account.id,
        type=TransactionType.DEPOSIT,
        amount=amount,
        status=TransactionStatus.SUCCESS,
        risk_score=0,
        risk_reason="Deposit"
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    # Log action
    log_action(db, user_id, "DEPOSIT", "Transaction", txn.id, {"amount": amount, "account_id": account_id})
    return txn

def withdraw_money(db: Session, account_id: int, amount: float, user_id: int) -> Transaction:
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if account.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    if account.balance < amount:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient balance")

    # Update account balance
    account.balance -= amount
    db.add(account)

    # Create transaction
    txn = Transaction(
        account_id=account.id,
        type=TransactionType.WITHDRAW,
        amount=amount,
        status=TransactionStatus.SUCCESS,
        risk_score=0,
        risk_reason="Withdrawal"
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    # Log action
    log_action(db, user_id, "WITHDRAWAL", "Transaction", txn.id, {"amount": amount, "account_id": account_id})
    return txn

def create_transfer_request(
    db: Session,
    account_id: int,
    beneficiary_account_number: str,
    amount: float,
    user_id: int,
    confirmed: bool = False
) -> tuple[Transaction, str]:
    # 1. Fetch and validate source account
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source account not found")

    if account.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized: Account owner mismatch")

    # 2. Fetch and validate beneficiary
    beneficiary = db.query(Beneficiary).filter(
        Beneficiary.account_number == beneficiary_account_number,
        Beneficiary.user_id == user_id
    ).first()
    if not beneficiary:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Beneficiary must exist. Please register the beneficiary first."
        )

    # 3. Prevent self-transfer
    if account.account_number == beneficiary.account_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transfer to the same source account."
        )

    # 3.5 Prevent duplicate transactions (within 15 seconds)
    dedup_window = datetime.datetime.utcnow() - datetime.timedelta(seconds=15)
    recent_dup = db.query(Transaction).filter(
        Transaction.account_id == account.id,
        Transaction.beneficiary_id == beneficiary.id,
        Transaction.amount == amount,
        Transaction.type == TransactionType.TRANSFER,
        Transaction.created_at >= dedup_window,
        Transaction.status != TransactionStatus.FAILED
    ).first()
    if recent_dup:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate transaction detected. Please wait 15 seconds before repeating the same transfer."
        )

    # 4. Assess risk
    risk_score, reasons = calculate_risk(db, account, beneficiary, amount)
    risk_level = get_risk_level(risk_score)
    risk_reason_str = ", ".join(reasons) if reasons else "Low risk transfer"

    # 5. Route based on risk level
    if risk_level == "HIGH":
        # Create transaction as PENDING_REVIEW
        txn = Transaction(
            account_id=account.id,
            beneficiary_id=beneficiary.id,
            type=TransactionType.TRANSFER,
            amount=amount,
            status=TransactionStatus.PENDING_REVIEW,
            risk_score=risk_score,
            risk_reason=f"HIGH RISK: {risk_reason_str}"
        )
        db.add(txn)
        db.flush()  # Get transaction ID

        # Create Review Request
        review_req = ReviewRequest(
            transaction_id=txn.id,
            reason=f"High risk score ({risk_score}): {risk_reason_str}",
            status=ReviewStatus.PENDING
        )
        db.add(review_req)
        db.commit()
        db.refresh(txn)

        log_action(db, user_id, "CREATE_TRANSFER_PENDING_REVIEW", "Transaction", txn.id, {
            "amount": amount,
            "beneficiary_id": beneficiary.id,
            "risk_score": risk_score,
            "reasons": reasons
        })
        return txn, "HIGH"

    elif risk_level == "MEDIUM":
        if not confirmed:
            # Raise exception containing the details (or client can check)
            raise MediumRiskConfirmationRequired(risk_score, reasons)
        
        # If confirmed, proceed to execution
        account.balance -= amount
        db.add(account)

        txn = Transaction(
            account_id=account.id,
            beneficiary_id=beneficiary.id,
            type=TransactionType.TRANSFER,
            amount=amount,
            status=TransactionStatus.SUCCESS,
            risk_score=risk_score,
            risk_reason=f"MEDIUM RISK (Confirmed): {risk_reason_str}"
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)

        log_action(db, user_id, "EXECUTE_TRANSFER_MEDIUM_RISK", "Transaction", txn.id, {
            "amount": amount,
            "beneficiary_id": beneficiary.id,
            "risk_score": risk_score,
            "reasons": reasons
        })
        return txn, "MEDIUM"

    else:  # LOW risk
        # Execute automatically
        account.balance -= amount
        db.add(account)

        txn = Transaction(
            account_id=account.id,
            beneficiary_id=beneficiary.id,
            type=TransactionType.TRANSFER,
            amount=amount,
            status=TransactionStatus.SUCCESS,
            risk_score=risk_score,
            risk_reason=risk_reason_str
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)

        log_action(db, user_id, "EXECUTE_TRANSFER_LOW_RISK", "Transaction", txn.id, {
            "amount": amount,
            "beneficiary_id": beneficiary.id,
            "risk_score": risk_score
        })
        return txn, "LOW"

def approve_review_request(db: Session, review_id: int, reviewer_id: int) -> Transaction:
    review = db.query(ReviewRequest).filter(ReviewRequest.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review request not found")

    if review.status != ReviewStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Review request is already resolved")

    txn = review.transaction
    if not txn or txn.status != TransactionStatus.PENDING_REVIEW:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Associated transaction is not pending review")

    # Double check balance at execution time
    account = txn.account
    if account.balance < txn.amount:
        # Fall back to failing
        txn.status = TransactionStatus.FAILED
        review.status = ReviewStatus.REJECTED
        review.reviewed_by = reviewer_id
        review.reviewed_at = datetime.datetime.utcnow()
        db.add(txn)
        db.add(review)
        db.commit()
        log_action(db, reviewer_id, "APPROVE_REVIEW_INSUFFICIENT_BALANCE_FAIL", "ReviewRequest", review.id, {"transaction_id": txn.id})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient balance to execute this transaction")

    # Deduct balance (safe execution)
    account.balance -= txn.amount
    db.add(account)

    # Update status
    txn.status = TransactionStatus.SUCCESS
    review.status = ReviewStatus.APPROVED
    review.reviewed_by = reviewer_id
    review.reviewed_at = datetime.datetime.utcnow()

    db.add(txn)
    db.add(review)
    db.commit()
    db.refresh(txn)

    log_action(db, reviewer_id, "APPROVE_REVIEW", "ReviewRequest", review.id, {"transaction_id": txn.id, "amount": txn.amount})
    return txn

def reject_review_request(db: Session, review_id: int, reviewer_id: int) -> Transaction:
    review = db.query(ReviewRequest).filter(ReviewRequest.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review request not found")

    if review.status != ReviewStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Review request is already resolved")

    txn = review.transaction
    if not txn or txn.status != TransactionStatus.PENDING_REVIEW:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Associated transaction is not pending review")

    # Update status (rejection)
    txn.status = TransactionStatus.REJECTED
    review.status = ReviewStatus.REJECTED
    review.reviewed_by = reviewer_id
    review.reviewed_at = datetime.datetime.utcnow()

    db.add(txn)
    db.add(review)
    db.commit()
    db.refresh(txn)

    log_action(db, reviewer_id, "REJECT_REVIEW", "ReviewRequest", review.id, {"transaction_id": txn.id})
    return txn