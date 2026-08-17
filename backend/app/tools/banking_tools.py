import re
from typing import List, Optional
from langchain_core.tools import tool
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import User, Account, Beneficiary, Transaction, TransactionStatus, TransactionType
from app.services.banking import create_transfer_request as execute_transfer_request, MediumRiskConfirmationRequired, deposit_money as execute_deposit, withdraw_money as execute_withdraw
from app.services.risk import calculate_risk, get_risk_level

def create_banking_tools(db: Session, user: User):
    """
    Dynamically constructs LangChain tools closing over the db session and current user
    to prevent prompt/parameter tampering or cross-user operations.
    """

    @tool
    def get_account_balance(account_id: Optional[int] = None) -> str:
        """
        Retrieves the balance for a specific bank account by its ID.
        If account_id is omitted, returns balances for all accounts owned by the user.
        """
        query = db.query(Account).filter(Account.user_id == user.id)
        if account_id is not None:
            query = query.filter(Account.id == account_id)

        accounts = query.all()
        if not accounts:
            return "No accounts found for the user."

        result = []
        for acc in accounts:
            result.append(f"Account ID: {acc.id} | Type: {acc.account_type} | Account Number: {acc.account_number} | Balance: ${acc.balance:,.2f}")
        return "\n".join(result)

    @tool
    def get_transaction_history(account_id: Optional[int] = None) -> str:
        """
        Retrieves the transaction history for a specific account.
        If account_id is omitted, returns history for all accounts owned by the user.
        """
        accounts_query = db.query(Account).filter(Account.user_id == user.id)
        if account_id is not None:
            accounts_query = accounts_query.filter(Account.id == account_id)

        accounts = accounts_query.all()
        if not accounts:
            return "No accounts found."

        acc_ids = [acc.id for acc in accounts]
        transactions = db.query(Transaction).filter(Transaction.account_id.in_(acc_ids)).order_by(Transaction.created_at.desc()).limit(10).all()

        if not transactions:
            return "No transactions found."

        result = ["Recent transactions:"]
        for txn in transactions:
            beneficiary_info = f" to account {txn.beneficiary.account_number}" if txn.beneficiary else ""
            status_info = f" ({txn.status.value})"
            result.append(
                f"- [TXN-{txn.id}] {txn.type.value} of ${txn.amount:,.2f}{beneficiary_info} on {txn.created_at.strftime('%Y-%m-%d %H:%M')}{status_info} | Risk Score: {txn.risk_score} | Details: {txn.risk_reason or 'N/A'}"
            )
        return "\n".join(result)

    @tool
    def get_account_details(account_id: Optional[int] = None) -> str:
        """
        Retrieves detailed information (ID, Number, Type, Balance) for the user's accounts.
        """
        return get_account_balance.invoke({"account_id": account_id})

    @tool
    def get_beneficiaries() -> str:
        """
        Retrieves the list of registered beneficiaries for the current user.
        """
        beneficiaries = db.query(Beneficiary).filter(Beneficiary.user_id == user.id).all()
        if not beneficiaries:
            return "No beneficiaries registered. You must register a beneficiary first before making a transfer."

        result = ["Registered Beneficiaries:"]
        for b in beneficiaries:
            status_str = "Verified" if b.is_verified else "Unverified"
            result.append(f"- Name: {b.name} | Account Number: {b.account_number} | Status: {status_str}")
        return "\n".join(result)

    @tool
    def create_transfer_request(source_account_id: int, beneficiary_account_number: str, amount: float, confirmed: bool = False) -> str:
        """
        Initiates a money transfer from a source account to a beneficiary account number.
        Set confirmed=True ONLY if the user has explicitly confirmed they want to bypass/acknowledge
        a medium-risk warning.
        """
        try:
            txn, risk_level = execute_transfer_request(
                db=db,
                account_id=source_account_id,
                beneficiary_account_number=beneficiary_account_number,
                amount=amount,
                user_id=user.id,
                confirmed=confirmed
            )

            if txn.status == TransactionStatus.PENDING_REVIEW:
                return (
                    f"TRANSFER_PENDING_REVIEW: The transfer of ${amount:,.2f} to account {beneficiary_account_number} "
                    f"is PENDING HUMAN REVIEW due to high risk (Risk Score: {txn.risk_score}). Transaction ID is TXN-{txn.id}."
                )
            elif txn.status == TransactionStatus.SUCCESS:
                return (
                    f"TRANSFER_SUCCESS: Successfully transferred ${amount:,.2f} to account {beneficiary_account_number}. "
                    f"Transaction ID is TXN-{txn.id}. Risk Level: {risk_level} (Score: {txn.risk_score})."
                )
            else:
                return f"TRANSFER_FAILED: Transaction finished with status {txn.status.value}."

        except MediumRiskConfirmationRequired as e:
            risk_score = e.detail["risk_score"]
            reasons = ", ".join(e.detail["reasons"])
            return (
                f"CONFIRMATION_REQUIRED: Risk score is {risk_score} (MEDIUM). Reasons: {reasons}. "
                f"Please confirm if you want to proceed with this transfer of ${amount:,.2f} to account {beneficiary_account_number}."
            )
        except HTTPException as e:
            return f"TRANSFER_BLOCKED: {e.detail}"
        except Exception as e:
            return f"TRANSFER_ERROR: An error occurred: {str(e)}"

    @tool
    def initiate_deposit(account_id: int, amount: float) -> str:
        """
        Deposits money into the specified account, increasing its balance immediately.
        Deposits are always low-risk and execute without additional confirmation.
        """
        try:
            txn = execute_deposit(db=db, account_id=account_id, amount=amount, user_id=user.id)
            return f"DEPOSIT_SUCCESS: Successfully deposited ${amount:,.2f}. Transaction ID is TXN-{txn.id}."
        except HTTPException as e:
            return f"DEPOSIT_BLOCKED: {e.detail}"
        except Exception as e:
            return f"DEPOSIT_ERROR: An error occurred: {str(e)}"

    @tool
    def initiate_withdrawal(account_id: int, amount: float) -> str:
        """
        Withdraws money from the specified account, decreasing its balance immediately,
        provided sufficient funds are available.
        """
        try:
            txn = execute_withdraw(db=db, account_id=account_id, amount=amount, user_id=user.id)
            return f"WITHDRAW_SUCCESS: Successfully withdrew ${amount:,.2f}. Transaction ID is TXN-{txn.id}."
        except HTTPException as e:
            return f"WITHDRAW_BLOCKED: {e.detail}"
        except Exception as e:
            return f"WITHDRAW_ERROR: An error occurred: {str(e)}"

    @tool
    def check_transaction_risk(source_account_id: int, beneficiary_account_number: str, amount: float) -> str:
        """
        Checks the transaction risk score and risk level for a proposed transfer without executing it.
        """
        account = db.query(Account).filter(Account.id == source_account_id, Account.user_id == user.id).first()
        if not account:
            return "Error: Source account not found or unauthorized."

        beneficiary = db.query(Beneficiary).filter(
            Beneficiary.account_number == beneficiary_account_number,
            Beneficiary.user_id == user.id
        ).first()
        if not beneficiary:
            return "Error: Beneficiary not found in your registered list. Please add them first."

        try:
            score, reasons = calculate_risk(db, account, beneficiary, amount)
            risk_level = get_risk_level(score)
            reasons_str = ", ".join(reasons) if reasons else "None (Low Risk)"
            return f"PROPOSED TRANSFER RISK: Score: {score} | Level: {risk_level} | Triggers: {reasons_str}"
        except HTTPException as e:
            return f"PROPOSED TRANSFER BLOCKED: {e.detail}"

    @tool
    def get_risk_profile() -> str:
        """
        Retrieves the user's risk profile based on their most recent transfer transactions,
        since risk scores are calculated per-transaction rather than stored as a single user-level value.
        """
        accounts = db.query(Account).filter(Account.user_id == user.id).all()
        if not accounts:
            return "No accounts found for the user."

        acc_ids = [a.id for a in accounts]
        recent_txns = db.query(Transaction).filter(
            Transaction.account_id.in_(acc_ids),
            Transaction.type == TransactionType.TRANSFER
        ).order_by(Transaction.created_at.desc()).limit(5).all()

        if not recent_txns:
            return (
                "You have no transfer transactions yet, so no risk score has been calculated. "
                "Risk scores are calculated at the time each transfer is initiated, based on amount, "
                "beneficiary verification status, transfer frequency, and time of day."
            )

        latest = recent_txns[0]
        lines = [
            f"Your most recent transfer (TXN-{latest.id}) had a risk score of {latest.risk_score} "
            f"({get_risk_level(latest.risk_score)} risk). Reason: {latest.risk_reason or 'N/A'}",
            "",
            "Recent risk history:"
        ]
        for t in recent_txns:
            lines.append(f"- TXN-{t.id}: Score {t.risk_score} ({get_risk_level(t.risk_score)}) on {t.created_at.strftime('%Y-%m-%d %H:%M')}")
        return "\n".join(lines)

    @tool
    def get_transaction_status(transaction_id: str) -> str:
        """
        Checks the status of a specific transaction (e.g. TXN-1023 or 1023).
        """
        # Parse transaction number
        match = re.search(r"\d+", transaction_id)
        if not match:
            return "Invalid transaction ID format. Please use format TXN-XXXX or a numerical ID."

        txn_id = int(match.group(0))
        txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
        if not txn:
            return f"Transaction TXN-{txn_id} not found."

        # Ensure user owns the transaction (account is owned by user)
        if txn.account.user_id != user.id:
            return "Unauthorized: You do not own the account associated with this transaction."

        beneficiary_str = f" to account {txn.beneficiary.account_number}" if txn.beneficiary else ""
        return (
            f"Transaction ID: TXN-{txn.id}\n"
            f"Type: {txn.type.value}\n"
            f"Amount: ${txn.amount:,.2f}{beneficiary_str}\n"
            f"Status: {txn.status.value}\n"
            f"Risk Score: {txn.risk_score}\n"
            f"Reasoning: {txn.risk_reason or 'N/A'}\n"
            f"Created At: {txn.created_at.strftime('%Y-%m-%d %H:%M UTC')}"
        )

    return [
        get_account_balance,
        get_transaction_history,
        get_account_details,
        get_beneficiaries,
        create_transfer_request,
        check_transaction_risk,
        get_transaction_status,
        get_risk_profile,
        initiate_deposit,
        initiate_withdrawal
    ]