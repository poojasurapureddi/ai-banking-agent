import random
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserRole, Account, Beneficiary
from app.schemas import UserCreate, UserResponse, LoginRequest, Token
from app.services.auth import get_password_hash, verify_password, create_access_token
from app.services.audit import log_action

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
        
    # Hash password
    hashed_pwd = get_password_hash(user_in.password)
    
    # Create user
    new_user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hashed_pwd,
        role=user_in.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Automatically provision a default checking account with some demo funds
    acc_num = f"ACC-{random.randint(100000, 999999)}"
    default_account = Account(
        user_id=new_user.id,
        account_number=acc_num,
        account_type="CHECKING",
        balance=5000.0  # provision $5,000 for capstone testing
    )
    db.add(default_account)
    
    # Automatically provision two demo beneficiaries
    # 1. John (Verified)
    john = Beneficiary(
        user_id=new_user.id,
        name="John Doe",
        account_number="11223344",
        is_verified=True
    )
    # 2. Bob (Unverified)
    bob = Beneficiary(
        user_id=new_user.id,
        name="Bob Smith",
        account_number="55667788",
        is_verified=False
    )
    db.add(john)
    db.add(bob)
    db.commit()

    # Log action
    log_action(db, new_user.id, "REGISTER", "User", new_user.id, {"email": new_user.email, "role": new_user.role.value})
    
    return new_user

@router.post("/login", response_model=Token)
def login(login_in: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email).first()
    if not user or not verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = create_access_token(data={"sub": user.email, "role": user.role.value})
    
    # Log action
    log_action(db, user.id, "LOGIN", "User", user.id, {"email": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name
    }
