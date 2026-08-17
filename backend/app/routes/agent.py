from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Account
from app.schemas import ChatRequest, ChatResponse
from app.services.auth import get_current_user
from app.agents.langchain_agent import run_banking_agent

router = APIRouter(prefix="/agent", tags=["AI Agent"])

@router.post("/chat", response_model=ChatResponse)
def agent_chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Resolve default account ID if not provided in the request
    account_id = req.account_id
    if not account_id:
        # Get first account owned by the user
        first_acc = db.query(Account).filter(Account.user_id == current_user.id).first()
        if first_acc:
            account_id = first_acc.id

    # Run the banking agent
    res = run_banking_agent(
        message=req.message,
        db=db,
        user=current_user,
        default_account_id=account_id
    )

    # Return standard response structure
    return ChatResponse(
        response=res.get("response", "No response generated."),
        status=res.get("status", "success"),
        risk_score=res.get("risk_score"),
        risk_level=res.get("risk_level"),
        transaction=res.get("transaction")
    )
