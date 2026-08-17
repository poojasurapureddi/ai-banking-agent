import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.models import User, UserRole, Account, Beneficiary
from app.services.auth import get_password_hash
from app.routes import auth, accounts, transactions, reviews, agent, admin

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Secure AI-powered banking agent with guardrails and human-in-the-loop review",
    version="1.0.0"
)

# Create tables during startup
@app.on_event("startup")
def init_db():
    import sys
    if "pytest" in sys.modules:
        return
    Base.metadata.create_all(bind=engine)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers under /api
app.include_router(auth.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(agent.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "project": settings.PROJECT_NAME}

# Seed default accounts on startup
@app.on_event("startup")
def seed_database():
    import sys
    if "pytest" in sys.modules:
        return
    db: Session = SessionLocal()
    try:
        # Check if users already exist
        admin_exists = db.query(User).filter(User.email == "admin@bank.com").first()
        if not admin_exists:
            logger.info("Seeding database with default accounts...")
            
            # Seed Admin
            admin_user = User(
                name="System Administrator",
                email="admin@bank.com",
                password_hash=get_password_hash("admin123"),
                role=UserRole.ADMIN
            )
            db.add(admin_user)
            
            # Seed Reviewer
            reviewer_user = User(
                name="Security Reviewer",
                email="reviewer@bank.com",
                password_hash=get_password_hash("reviewer123"),
                role=UserRole.REVIEWER
            )
            db.add(reviewer_user)
            
            # Seed Customer
            customer_user = User(
                name="Alice Johnson",
                email="customer@bank.com",
                password_hash=get_password_hash("customer123"),
                role=UserRole.CUSTOMER
            )
            db.add(customer_user)
            db.flush()  # get customer ID
            
            # Set up Customer Account
            customer_account = Account(
                user_id=customer_user.id,
                account_number="ACC-998877",
                account_type="CHECKING",
                balance=150000.0  # Give large balance to trigger high amount tests (>50,000)
            )
            db.add(customer_account)
            
            # Set up Beneficiaries for Customer
            john = Beneficiary(
                user_id=customer_user.id,
                name="John Doe",
                account_number="11223344",
                is_verified=True
            )
            bob = Beneficiary(
                user_id=customer_user.id,
                name="Bob Smith",
                account_number="55667788",
                is_verified=False
            )
            db.add(john)
            db.add(bob)
            
            db.commit()
            logger.info("Seeding completed successfully.")
        else:
            logger.info("Database users already seeded.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding database: {e}")
    finally:
        db.close()
