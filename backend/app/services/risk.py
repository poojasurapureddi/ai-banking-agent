from datetime import datetime, timedelta
from typing import Tuple, List
from sqlalchemy.orm import Session
from app.models import Account, Beneficiary, Transaction, TransactionType
from fastapi import HTTPException, status

def calculate_risk(
    db: Session,
    account: Account,
    beneficiary: Beneficiary,
    amount: float
) -> Tuple[int, List[str]]:
    score = 0
    reasons = []

    # 1. Insufficient balance: BLOCK
    if account.balance < amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="BLOCK: Insufficient balance"
        )

    # 2. Amount > 50,000: +30
    if amount > 50000:
        score += 30
        reasons.append("Transaction amount exceeds 50,000")

    # 3. New/Unverified beneficiary: +25
    if not beneficiary.is_verified:
        score += 25
        reasons.append("Transfer to an unverified beneficiary")

    # 4. Multiple recent transfers: +20
    # Defined as 3 or more transfers from this account in the past 24 hours
    one_day_ago = datetime.utcnow() - timedelta(days=1)
    recent_transfers_count = db.query(Transaction).filter(
        Transaction.account_id == account.id,
        Transaction.type == TransactionType.TRANSFER,
        Transaction.created_at >= one_day_ago
    ).count()
    if recent_transfers_count >= 3:
        score += 20
        reasons.append("High transfer frequency (3+ transfers in 24h)")

    # 5. Unusual transaction: +25
    # Defined as transfer made during odd hours (11 PM - 5 AM UTC/Local time)
    current_hour = datetime.utcnow().hour
    if current_hour >= 23 or current_hour < 5:
        score += 25
        reasons.append("Odd-hours transaction (between 11 PM and 5 AM)")

    score = min(score, 100)
    return score, reasons

def get_risk_level(score: int) -> str:
    if score <= 30:
        return "LOW"
    elif score <= 60:
        return "MEDIUM"
    else:
        return "HIGH"
