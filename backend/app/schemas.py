from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from app.models import UserRole, TransactionType, TransactionStatus, ReviewStatus

# Auth Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole = UserRole.CUSTOMER

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: UserRole
    name: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[UserRole] = None

# Account Schemas
class AccountBase(BaseModel):
    account_number: str
    account_type: str
    balance: float
    status: str = "ACTIVE"
    
class AccountCreate(BaseModel):
    account_type: str  # "CHECKING" or "SAVINGS"

class AccountResponse(AccountBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Beneficiary Schemas
class BeneficiaryBase(BaseModel):
    name: str
    account_number: str

class BeneficiaryCreate(BeneficiaryBase):
    pass

class BeneficiaryResponse(BeneficiaryBase):
    id: int
    user_id: int
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Transaction Schemas
class DepositRequest(BaseModel):
    account_id: int
    amount: float = Field(..., gt=0, description="Amount must be greater than zero")

class WithdrawRequest(BaseModel):
    account_id: int
    amount: float = Field(..., gt=0, description="Amount must be greater than zero")

class TransferRequest(BaseModel):
    account_id: int
    beneficiary_account_number: str
    amount: float = Field(..., gt=0, description="Amount must be greater than zero")
    confirmed: bool = Field(default=False, description="Flag for user-confirmed medium-risk transfers")

class TransactionResponse(BaseModel):
    id: int
    account_id: int
    beneficiary_id: Optional[int] = None
    type: TransactionType
    amount: float
    status: TransactionStatus
    risk_score: int
    risk_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Extended transaction schema for the Transactions page, which lists across
# all of a user's accounts and needs to show which account each row belongs to.
class TransactionWithAccountResponse(TransactionResponse):
    account_number: str

# Nested schemas for review queue display (customer name + account number)
class ReviewTransactionAccountUser(BaseModel):
    name: str

    class Config:
        from_attributes = True

class ReviewTransactionAccount(BaseModel):
    account_number: str
    user: ReviewTransactionAccountUser

    class Config:
        from_attributes = True

class ReviewTransactionResponse(TransactionResponse):
    account: ReviewTransactionAccount

# Review Request Schemas
class ReviewRequestResponse(BaseModel):
    id: int
    transaction_id: int
    reason: str
    status: ReviewStatus
    reviewed_by: Optional[int] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    # We can nest transaction details to display on dashboard
    transaction: Optional[ReviewTransactionResponse] = None

    class Config:
        from_attributes = True

# Audit Log Schema
class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Agent Chat Schemas
class ChatRequest(BaseModel):
    message: str
    account_id: Optional[int] = None  # Helper to pass default context from UI

class ChatResponse(BaseModel):
    response: str
    status: str = "success"  # "success", "error", "confirmation_required", "review_required"
    transaction: Optional[TransactionResponse] = None
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None