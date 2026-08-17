from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, UserRole, ReviewRequest, Transaction
from app.schemas import ReviewRequestResponse, TransactionResponse
from app.services.auth import RoleChecker, get_current_user
from app.services.banking import approve_review_request, reject_review_request

router = APIRouter(prefix="/reviews", tags=["Human-in-the-loop Reviews"])

# Verify user is a REVIEWER or ADMIN
reviewer_admin_checker = RoleChecker([UserRole.REVIEWER, UserRole.ADMIN])

@router.get("", response_model=List[ReviewRequestResponse])
def list_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(reviewer_admin_checker)
):
    reviews = db.query(ReviewRequest).order_by(ReviewRequest.created_at.desc()).all()
    return reviews

@router.get("/{review_id}", response_model=ReviewRequestResponse)
def get_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(reviewer_admin_checker)
):
    review = db.query(ReviewRequest).filter(ReviewRequest.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review request not found")
    return review

@router.post("/{review_id}/approve")
def approve_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(reviewer_admin_checker)
):
    txn = approve_review_request(db, review_id, current_user.id)
    return {
        "message": f"Transaction TXN-{txn.id} approved successfully and executed.",
        "status": txn.status,
        "transaction_id": txn.id
    }

@router.post("/{review_id}/reject")
def reject_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(reviewer_admin_checker)
):
    txn = reject_review_request(db, review_id, current_user.id)
    return {
        "message": f"Transaction TXN-{txn.id} has been rejected.",
        "status": txn.status,
        "transaction_id": txn.id
    }
