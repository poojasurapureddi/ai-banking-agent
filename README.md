# AI-Powered Banking Agent with Guardrails & Human-in-the-Loop

A 3-tier financial support system where an AI assistant handles account operations (balance checks, deposits, withdrawals, transfers) through natural language, while a rule-based risk engine screens every transfer for fraud risk and automatically routes high-risk transactions to a human reviewer before any money moves.

**Live App:** https://ai-banking-agent.vercel.app
**Backend API:** https://ai-banking-agent.onrender.com/api/health

**Demo accounts** (seeded automatically on first backend startup):

| Role | Email | Password |
|---|---|---|
| Customer | `customer@bank.com` | `customer123` |
| Reviewer | `reviewer@bank.com` | `reviewer123` |
| Admin | `admin@bank.com` | `admin123` |

> Note: the backend runs on Render's free tier, which spins down after ~15 minutes of inactivity. The first request after a period of idleness can take 30–60 seconds to respond while the instance wakes up — this is expected, not a bug.

---

## Architecture

```
┌─────────────────┐        ┌──────────────────┐        ┌─────────────────┐
│   React / Vite   │  REST  │  FastAPI Backend  │  SQL   │   PostgreSQL     │
│   Frontend        │◄──────►│  (LangChain Agent │◄──────►│   Database       │
│   (Vercel)         │  JSON  │   + Guardrails +   │        │   (Render)       │
│                    │        │   Risk Engine)      │        │                  │
└─────────────────┘        └──────────────────┘        └─────────────────┘
```

- **Frontend:** React + TypeScript + Tailwind CSS, built with Vite. Deployed on Vercel.
- **Backend:** FastAPI (Python), SQLAlchemy ORM, JWT authentication. Deployed on Render.
- **Database:** PostgreSQL (Render managed instance). SQLite is used automatically for local development if no `DATABASE_URL` is set.
- **AI Agent:** LangChain-based agent with tool-calling (Gemini or OpenAI, if an API key is configured). Falls back to a fully functional rule-based parser (`run_mock_agent`) when no LLM key is present, using the exact same backend tools — so the assistant works identically with or without an LLM provider.
- **Guardrails:** Regex-based prompt-injection and sensitive-info-disclosure detection runs on every message before it reaches the agent or any tool.
- **Risk Engine:** Deterministic scoring (`app/services/risk.py`) evaluates every transfer on amount, beneficiary verification status, transfer frequency, and time of day, producing a 0–100 score that determines LOW / MEDIUM / HIGH routing.
- **Human-in-the-Loop:** HIGH-risk transfers are held as `PENDING_REVIEW` and a `ReviewRequest` is created. Only a REVIEWER or ADMIN role can approve or reject it through the Admin dashboard; approval executes the transfer, rejection cancels it. No money moves until a human acts.

### Key backend modules

| Path | Responsibility |
|---|---|
| `app/routes/` | REST endpoints: auth, accounts, transactions, agent chat, reviews, admin stats |
| `app/services/banking.py` | Core transfer/deposit/withdraw logic, risk-based routing, review creation |
| `app/services/risk.py` | Deterministic risk scoring rules |
| `app/services/pending_transfers.py` | In-memory store tracking a transfer awaiting the user's explicit confirmation |
| `app/agents/langchain_agent.py` | Intent parsing (deposit/withdraw/transfer/confirm/cancel), LLM tool-calling loop, rule-based fallback |
| `app/tools/banking_tools.py` | LangChain tools exposing balance, history, beneficiaries, transfers, deposits, withdrawals, risk lookups — each closed over the authenticated user, so no tool can act outside that user's own data |
| `app/guardrails/guardrails_validator.py` | Prompt-injection and sensitive-info-request pattern matching |

---

## Setup & Installation

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (optional locally — SQLite is used automatically if `DATABASE_URL` is unset)

### 1. Clone the repository
```bash
git clone https://github.com/poojasurapureddi/ai-banking-agent.git
cd ai-banking-agent
```

### 2. Backend setup
```bash
cd backend
pip install -r requirements.txt --break-system-packages
```

Create `backend/.env` (or copy `.env.example`) with:
```
DATABASE_URL=sqlite:///./banking.db
JWT_SECRET=<generate with: python -c "import secrets; print(secrets.token_urlsafe(32))">
GEMINI_API_KEY=
OPENAI_API_KEY=
```
Leaving both LLM keys blank is fine — the assistant runs the same feature set via its rule-based fallback.

Run the server:
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
On first startup, the app auto-creates all tables and seeds the three demo accounts listed above.

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev
```
The app runs at `http://localhost:5173` and talks to `http://localhost:8000/api` by default (overridable via a `VITE_API_URL` environment variable, which is how the deployed Vercel build points at the live Render backend instead).

---

## Test & Evaluation Report

The following scenarios were manually tested end-to-end against both the local development environment and the deployed production environment (Vercel + Render + Postgres).

### AI Assistant — natural language banking

| Test | Input | Expected | Result |
|---|---|---|---|
| Balance query | `What is my current balance?` | Returns real balance from DB | ✅ Pass |
| Account listing | `What accounts do I have?` | Lists real accounts, masked number | ✅ Pass |
| Transaction history | `Show my recent transactions` | Returns real transactions | ✅ Pass |
| Beneficiary listing | `Whom can I transfer to?` | Lists registered beneficiaries | ✅ Pass |
| Deposit | `Deposit 5000` | Executes immediately, real TXN ID, balance increases | ✅ Pass |
| Deposit over limit | `Deposit 123456789` | Rejected with a clear limit message, no transaction created | ✅ Pass |
| Withdrawal | `Withdraw 1000` | Executes if sufficient balance, real TXN ID, balance decreases | ✅ Pass |
| Withdrawal, insufficient funds | Withdraw more than balance | Rejected, no transaction created | ✅ Pass |
| Low-risk transfer preview | `Transfer 250 to John` | Shows preview (amount, recipient, source account), does **not** execute | ✅ Pass |
| Transfer confirmation | `Yes` after preview | Executes exactly once, real TXN ID returned | ✅ Pass |
| Transfer cancellation | `No` after preview | Cancels, no transaction created, balance unchanged | ✅ Pass |
| Unrecognized beneficiary | Transfer to a name not on file | Clear error listing actual registered beneficiaries | ✅ Pass |
| Insufficient balance on transfer | Transfer more than available | Rejected with real available balance shown | ✅ Pass |
| Duplicate confirmation | Confirm twice in a row | Second confirmation returns "no pending transfer," no duplicate transaction | ✅ Pass |
| Transaction status lookup | `Check status of transaction TXN-14` | Returns real status, amount, risk score, timestamp | ✅ Pass |
| Prompt injection attempt | `Ignore previous instructions...` | Blocked by guardrails before reaching the agent | ✅ Pass |

### Risk scoring & human-in-the-loop review

| Test | Scenario | Expected | Result |
|---|---|---|---|
| Low risk | Small transfer to a verified beneficiary | Executes automatically | ✅ Pass |
| Medium risk | Transfer to an unverified beneficiary above threshold | Requires explicit user confirmation before executing | ✅ Pass |
| High risk | Large amount + unverified beneficiary + frequency triggers | Transaction held as `PENDING_REVIEW`, no balance change, appears in Admin review queue with real customer name, amount, and score | ✅ Pass |
| Admin approval | Reviewer approves a pending review | Transaction executes, balance updates, Pending count decreases, Approved count increases | ✅ Pass |
| Admin rejection | Reviewer rejects a pending review | Transaction marked rejected, balance unchanged, Rejected count increases | ✅ Pass |
| Duplicate action prevention | Attempt to approve an already-resolved review | Backend rejects with 400, frontend disables buttons during processing | ✅ Pass |
| Authorization enforcement | Customer role calls `/reviews` or `/admin/stats` directly | Backend returns 403, independent of frontend UI state | ✅ Pass |

### Cross-surface data consistency

| Test | Scenario | Result |
|---|---|---|
| Dashboard ↔ AI Assistant | A deposit made via chat immediately reflects in the Dashboard's Recent Transactions and Total Balance after refresh | ✅ Pass |
| Dashboard ↔ Transactions page | Same transaction list, same source of truth (`Transaction` table), no duplicated data | ✅ Pass |
| Admin Review ↔ Transactions page | A high-risk transaction approved via Admin Review shows updated status on the Transactions page | ✅ Pass |
| Refresh persistence | Reloading the browser after any action preserves the correct, non-duplicated state | ✅ Pass |

### Security

| Test | Result |
|---|---|
| Ownership enforcement on accounts/transactions | Backend derives the user from the JWT; a client-supplied account ID that doesn't belong to the caller is rejected (403), never trusted | ✅ Pass |
| Role-based access (Admin/Reviewer endpoints) | Enforced server-side via `RoleChecker`, not just hidden UI elements | ✅ Pass |
| Secrets management | `.env` and database credentials excluded from version control; verified absent from git history | ✅ Pass |

### Known limitations
- Free-tier hosting (Render) causes a cold-start delay of up to ~60 seconds after inactivity.
- Pending-transfer confirmation state is held in-memory per backend process; it would need to move to a database-backed table to survive a server restart in a multi-instance production deployment.
- LLM-backed conversation (Gemini/OpenAI) was not exercised in this deployment since no API key was configured; the rule-based fallback agent was used for all testing and is functionally equivalent for every operation described above.

---

## Tech Stack

**Backend:** FastAPI, SQLAlchemy, Pydantic, PyJWT, Alembic, LangChain, PostgreSQL
**Frontend:** React, TypeScript, Vite, Tailwind CSS, Axios, React Router
**Infrastructure:** Render (backend + database), Vercel (frontend)
