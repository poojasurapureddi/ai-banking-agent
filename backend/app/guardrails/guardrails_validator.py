import re
from fastapi import HTTPException, status

# Patterns to detect prompt injections
PROMPT_INJECTION_PATTERNS = [
    r"(?i)ignore\s+(all\s+)?(previous\s+)?(instructions|rules|security|prompts)",
    r"(?i)system\s+instructions",
    r"(?i)override\s+(security|validation|rules)",
    r"(?i)bypass\s+(security|validation|rules)",
    r"(?i)developer\s+mode",
    r"(?i)you\s+are\s+now\s+a\s+different\s+assistant",
    r"(?i)as\s+an\s+unrestricted\s+ai",
    r"(?i)dan\s+mode"
]

# Patterns to block leak of sensitive/internal parameters or system setup
SENSITIVE_INFO_PATTERNS = [
    r"(?i)reveal\s+(your\s+)?(system\s+)?(prompt|instruction|rules)",
    r"(?i)what\s+is\s+your\s+system\s+prompt",
    r"(?i)password",
    r"(?i)hash",
    r"(?i)jwt\s+secret",
    r"(?i)secret\s+key",
    r"(?i)database\s+credentials"
]

def check_prompt_injection(message: str) -> None:
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, message):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Guardrails Refusal: Prompt injection attempt detected. Request blocked."
            )

def check_sensitive_info_requests(message: str) -> None:
    for pattern in SENSITIVE_INFO_PATTERNS:
        if re.search(pattern, message):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Guardrails Refusal: Request to disclose sensitive system details or prompts is blocked."
            )

def validate_transfer_input(amount: float, beneficiary_account_number: str) -> None:
    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Guardrails Validation: Transfer amount must be positive."
        )
    # Simple alphanumeric check for standard account numbers
    if not re.match(r"^[A-Za-z0-9-]{5,30}$", beneficiary_account_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Guardrails Validation: Invalid account number format."
        )
