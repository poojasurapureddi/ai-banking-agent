# AI-Powered Banking Agent with Guardrails & Human-in-the-Loop Review

A production-style 3-tier secure banking system featuring a conversational React frontend, a robust FastAPI backend, and an intelligent compliance validation engine. Customers can manage balances and request transactions via chat, while administrators and compliance reviewers oversee risk queues and access immutable ledger audits.

---

## Architecture Diagram

```
React Frontend (Vite + TypeScript)
       │
       │ HTTP / JSON REST API
       ▼
FastAPI Security Layer (JWT Auth + Role-Based Access)
       │
       ├─► Guardrails AI (Prompt injection prevention & input sanitation)
       │
       ├─► LangChain Agent (Dynamic tool closures for secure accounts query)
       │
       ├─► Risk Evaluation Engine (Low, Medium, High Risk classification)
       │
       ├─► Human Review Queue (Approve / Reject hold states)
       │
       ▼
PostgreSQL Database (SQLAlchemy Models)
```

---

## Tech Stack

- **Frontend**: React (18), TypeScript, Tailwind CSS, React Router, Axios, Lucide Icons
- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, Pydantic (v2), PyJWT, Uvicorn
- **AI Agent**: LangChain (OpenAI / Gemini integrations with local Mock Fallback)
- **Database**: PostgreSQL (Dockerized) / SQLite (In-Memory for unit testing)
- **Deployment**: Docker & Docker Compose

---

## Database Schema Design

### 1. User
- `id` (Integer, Primary Key)
- `name` (String, Non-Nullable)
- `email` (String, Unique, Indexed)
- `password_hash` (String, Non-Nullable)
- `role` (Enum: `CUSTOMER`, `REVIEWER`, `ADMIN`)
- `created_at` (DateTime)

### 2. Account
- `id` (Integer, Primary Key)
- `user_id` (Integer, Foreign Key Users)
- `account_number` (String, Unique, Indexed)
- `account_type` (String, e.g. "CHECKING", "SAVINGS")
- `balance` (Float)
- `created_at` (DateTime)

### 3. Beneficiary
- `id` (Integer, Primary Key)
- `user_id` (Integer, Foreign Key Users)
- `name` (String)
- `account_number` (String)
- `is_verified` (Boolean)
- `created_at` (DateTime)

### 4. Transaction
- `id` (Integer, Primary Key)
- `account_id` (Integer, Foreign Key Accounts)
- `beneficiary_id` (Integer, Foreign Key Beneficiaries, Optional)
- `type` (Enum: `DEPOSIT`, `WITHDRAW`, `TRANSFER`)
- `amount` (Float)
- `status` (Enum: `PENDING_REVIEW`, `SUCCESS`, `REJECTED`, `FAILED`)
- `risk_score` (Integer)
- `risk_reason` (String, Optional)
- `created_at` (DateTime)

### 5. ReviewRequest
- `id` (Integer, Primary Key)
- `transaction_id` (Integer, Foreign Key Transactions)
- `reason` (String)
- `status` (Enum: `PENDING`, `APPROVED`, `REJECTED`)
- `reviewed_by` (Integer, Foreign Key Users, Optional)
- `created_at` (DateTime)
- `reviewed_at` (DateTime, Optional)

### 6. AuditLog
- `id` (Integer, Primary Key)
- `user_id` (Integer, Foreign Key Users, Optional)
- `action` (String)
- `entity_type` (String)
- `entity_id` (Integer, Optional)
- `details` (String/Text JSON, Optional)
- `created_at` (DateTime)

---

## REST API Documentation

### Authentication
- `POST /api/auth/register` - Create user. Provisons default Checking account ($5,000) and two default beneficiaries.
- `POST /api/auth/login` - Validate password, generate JWT containing sub and role claims.

### Accounts
- `GET /api/accounts` - Retrieve all accounts owned by the session customer.
- `GET /api/accounts/{account_id}` - Retrieve details of a specific account.
- `GET /api/accounts/{account_id}/transactions` - Fetch transaction history logs.
- `GET /api/accounts/all/beneficiaries` - Retrieve registered beneficiaries.
- `POST /api/accounts/all/beneficiaries` - Add a new beneficiary to the account list.

### Transactions
- `POST /api/transactions/deposit` - Increment account balance.
- `POST /api/transactions/withdraw` - Deduct balance if sufficient funds are present.
- `POST /api/transactions/transfer` - Transfer funds. Evaluates risk rules and routes to compliance checks or confirmation.

### Compliance Reviews (Reviewers & Admins)
- `GET /api/reviews` - List all review queue request logs.
- `GET /api/reviews/{review_id}` - Fetch audit detail for a transaction.
- `POST /api/reviews/{review_id}/approve` - Execute transaction safely and modify accounts balance.
- `POST /api/reviews/{review_id}/reject` - Refuse transaction, setting status to rejected.

### AI Assistant
- `POST /api/agent/chat` - Dispatch conversational queries to the guardrails-protected agent.

### Admin Tools (Admin Only)
- `GET /api/admin/audit-logs` - Retrieve the system operations audit ledger.

---

## Compliance & Security Logic

### 1. Guardrails
- **Prompt Injection**: Scans for patterns like "ignore previous instructions" or "developer mode override" and returns an HTTP 400 Refusal.
- **Sensitive Data Block**: Intercepts queries seeking database details, keys, or passwords.
- **Parameters Validation**: Blocks negative money fields, invalid account numbers, and ensures the LLM tools operate only within the authenticated customer's closures.

### 2. Risk Evaluation Engine
- `Amount > 50,000`: **+30 points**
- `New/Unverified Beneficiary`: **+25 points**
- `High Transfer Frequency (3+ in 24h)`: **+20 points**
- `Odd hours (11 PM - 5 AM)`: **+25 points**
- **Sufficient Balance**: Any transfer exceeding balance is blocked immediately (No transaction is logged).

**Risk Routing Action:**
- **LOW (0 - 30)**: Automatically executed.
- **MEDIUM (31 - 60)**: Requires user override. If `confirmed` flag is absent, returns `confirmation_required` with risk warnings. Confirming prompts the frontend to resend with `confirmed=True`.
- **HIGH (61 - 100)**: Suspended to `PENDING_REVIEW` and inserts ReviewRequest. Balances are left unchanged until approved.

---

## AI Agent Tools

The LangChain agent has access to secure tool wrappers that execute the backend services:
1. `get_account_balance`
2. `get_transaction_history`
3. `get_account_details`
4. `get_beneficiaries`
5. `create_transfer_request`
6. `check_transaction_risk`
7. `get_transaction_status`

---

## Local Development & Installation

### Environment Variables
Configure a `.env` in the root:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/banking_db
JWT_SECRET=supersecretjwtkeyforbankingapplication12345!
# Optional API Keys for LangChain Agent:
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key
```

### Docker Setup
The entire stack can be launched via Docker Compose:
```bash
docker compose up --build
```
This runs three services:
1. `postgres` (port `5432`)
2. `backend` (FastAPI at `http://localhost:8000`)
3. `frontend` (React Vite at `http://localhost:5173`)

### Seeding Accounts
On startup, the system automatically creates three roles:
- **Customer**: `customer@bank.com` / `customer123` (Alice Johnson, $150k checking)
- **Reviewer**: `reviewer@bank.com` / `reviewer123`
- **Admin**: `admin@bank.com` / `admin123`

### Testing
To run the automated pytest suite locally:
```bash
cd backend
python -m pip install -r requirements.txt
python -m pytest
```
