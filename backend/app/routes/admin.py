from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, UserRole, AuditLog, Account, Transaction, ReviewRequest, ReviewStatus
from app.schemas import AuditLogResponse
from app.services.auth import RoleChecker, get_current_user

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

admin_checker = RoleChecker([UserRole.ADMIN])
stats_checker = RoleChecker([UserRole.ADMIN, UserRole.REVIEWER])

@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_checker)
):
    # Retrieve audit logs sorted by created time
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).all()
    return logs

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(stats_checker)
):
    """
    Aggregate counts for the dashboard KPI cards and review queue summary.
    Restricted to ADMIN and REVIEWER roles, matching the access level of /reviews.
    """
    total_users = db.query(User).count()
    total_accounts = db.query(Account).count()
    total_transactions = db.query(Transaction).count()

    pending_reviews = db.query(ReviewRequest).filter(ReviewRequest.status == ReviewStatus.PENDING).count()
    approved_reviews = db.query(ReviewRequest).filter(ReviewRequest.status == ReviewStatus.APPROVED).count()
    rejected_reviews = db.query(ReviewRequest).filter(ReviewRequest.status == ReviewStatus.REJECTED).count()
    total_reviews = db.query(ReviewRequest).count()

    return {
        "total_users": total_users,
        "total_accounts": total_accounts,
        "total_transactions": total_transactions,
        "pending_reviews": pending_reviews,
        "approved_reviews": approved_reviews,
        "rejected_reviews": rejected_reviews,
        "total_reviews": total_reviews
    }