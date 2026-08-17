from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Account, Transaction, Beneficiary, User
from app.schemas import AccountResponse, TransactionResponse, BeneficiaryResponse, BeneficiaryCreate
from app.services.auth import get_current_user

router = APIRouter(prefix="/accounts", tags=["Accounts"])

@router.get("", response_model=List[AccountResponse])
def list_accounts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    return accounts

@router.get("/{account_id}", response_model=AccountResponse)
def get_account(account_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    if account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return account

@router.get("/{account_id}/transactions", response_model=List[TransactionResponse])
def get_account_transactions(account_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    if account.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    transactions = db.query(Transaction).filter(Transaction.account_id == account_id).order_by(Transaction.created_at.desc()).all()
    return transactions

# Beneficiary management endpoints for UI access
@router.get("/all/beneficiaries", response_model=List[BeneficiaryResponse])
def get_beneficiaries(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    beneficiaries = db.query(Beneficiary).filter(Beneficiary.user_id == current_user.id).all()
    return beneficiaries

@router.post("/all/beneficiaries", response_model=BeneficiaryResponse)
def add_beneficiary(
    beneficiary_in: BeneficiaryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if duplicate beneficiary number for this user
    dup = db.query(Beneficiary).filter(
        Beneficiary.user_id == current_user.id,
        Beneficiary.account_number == beneficiary_in.account_number
    ).first()
    if dup:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Beneficiary with this account number already exists")
        
    new_beneficiary = Beneficiary(
        user_id=current_user.id,
        name=beneficiary_in.name,
        account_number=beneficiary_in.account_number,
        is_verified=False  # default unverified
    )
    db.add(new_beneficiary)
    db.commit()
    db.refresh(new_beneficiary)
    return new_beneficiary
