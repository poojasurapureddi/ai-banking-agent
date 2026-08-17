import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Landmark,
  Send as SendIcon,
  Bot,
  User as UserIcon,
  AlertTriangle,
  Check,
  Plus,
  Minus,
  TrendingUp,
  CreditCard,
  History,
  Loader2,
  Users,
  Sun,
  Moon,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Activity
} from 'lucide-react';

interface Account {
  id: number;
  account_number: string;
  account_type: string;
  balance: number;
}

interface Transaction {
  id: number;
  account_id: number;
  beneficiary_id?: number;
  type: 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER';
  amount: number;
  status: 'PENDING_REVIEW' | 'SUCCESS' | 'REJECTED' | 'FAILED';
  risk_score: number;
  risk_reason?: string;
  created_at: string;
}

interface Beneficiary {
  id: number;
  name: string;
  account_number: string;
  is_verified: boolean;
}

interface ReviewRequest {
  id: number;
  transaction_id: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  transaction?: {
    id: number;
    amount: number;
    risk_score: number;
    risk_reason?: string;
    account: {
      account_number: string;
      user: {
        name: string;
      }
    };
  }
}

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
  status?: 'success' | 'error' | 'confirmation_required' | 'review_required';
  risk_score?: number;
  risk_level?: string;
  pendingTransfer?: {
    account_id: number;
    beneficiary_account_number: string;
    amount: number;
  };
}

// NOTE: adjust these two paths if your app's actual routes differ.
const ACCOUNTS_ROUTE = '/accounts';
const TRANSACTIONS_ROUTE = '/transactions';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = window.localStorage.getItem('darkMode');
      return stored === 'true';
    } catch {
      return false;
    }
  });
  const { user, logout } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [processingReviewId, setProcessingReviewId] = useState<number | null>(null);
  const [stats, setStats] = useState<{
    total_users: number;
    total_accounts: number;
    total_transactions: number;
    pending_reviews: number;
    approved_reviews: number;
    rejected_reviews: number;
    total_reviews: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);

  // Forms states
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [transferBeneficiary, setTransferBeneficiary] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [newBeneName, setNewBeneName] = useState('');
  const [newBeneAcc, setNewBeneAcc] = useState('');
  const [activeQuickTab, setActiveQuickTab] = useState<'deposit' | 'withdraw' | 'transfer' | 'add_beneficiary' | null>(null);

  // Quick Actions dropdown (Task 1)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Assistant Chat states
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "Hello! I am your SecureTrust AI Banking Assistant. Ask me about your balance, transaction history, or to initiate a transfer.",
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Confirmation Modal states for Medium Risk (manual transfer route)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [mediumRiskData, setMediumRiskData] = useState<{
    risk_score: number;
    reasons: string[];
    account_id: number;
    beneficiary_account_number: string;
    amount: number;
  } | null>(null);

  // ---------------------------------------------------------------------
  // Theme tokens (UI-only). Everything below derives its classNames from
  // this single source of truth so light/dark stay consistent everywhere.
  // ---------------------------------------------------------------------
  const t = {
    page: darkMode ? 'bg-[#0b1120]' : 'bg-slate-50',
    sidebar: darkMode ? 'bg-[#0a0e18] border-slate-800/80' : 'bg-white border-slate-200',
    sidebarActive: darkMode
      ? 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30'
      : 'text-blue-600 bg-blue-50 border-blue-100',
    navIdle: darkMode ? 'text-slate-400' : 'text-slate-600',
    navHover: darkMode ? 'hover:text-slate-100 hover:bg-white/5' : 'hover:text-slate-900 hover:bg-slate-50',
    navIcon: darkMode ? 'text-slate-500' : 'text-slate-400',
    card: darkMode ? 'bg-[#111827] border-slate-800/80' : 'bg-white border-slate-200',
    cardAlt: darkMode ? 'bg-[#0a0e18] border-slate-800/70' : 'bg-slate-50 border-slate-200',
    textPrimary: darkMode ? 'text-slate-100' : 'text-slate-900',
    textSecondary: darkMode ? 'text-slate-400' : 'text-slate-500',
    textMuted: darkMode ? 'text-slate-600' : 'text-slate-400',
    divider: darkMode ? 'border-slate-800/80' : 'border-slate-200',
    input: darkMode
      ? 'bg-[#0a0e18] border border-slate-700 text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40'
      : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const accRes = await api.get('/accounts');
      setAccounts(accRes.data);

      if (accRes.data.length > 0) {
        const active = accRes.data[0];
        setActiveAccount(active);

        // Fetch transactions for active account
        const txnRes = await api.get(`/accounts/${active.id}/transactions`);
        setTransactions(txnRes.data);
      }

      const beneRes = await api.get('/accounts/all/beneficiaries');
      setBeneficiaries(beneRes.data);

      // Fetch reviews (customers get 403 since this is ADMIN/REVIEWER only — show empty state, never fake data)
      try {
        const revRes = await api.get('/reviews');
        setReviews(revRes.data);
      } catch (e) {
        setReviews([]);
      }

      // Fetch dashboard stats (same access restriction as reviews)
      try {
        const statsRes = await api.get('/admin/stats');
        setStats(statsRes.data);
      } catch (e) {
        setStats(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load banking data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Quick Actions dropdown: close on outside click or Escape (Task 1)
  useEffect(() => {
    if (!quickActionsOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) {
        setQuickActionsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQuickActionsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [quickActionsOpen]);

  // Persist dark mode preference across refreshes
  useEffect(() => {
    try {
      window.localStorage.setItem('darkMode', String(darkMode));
    } catch {
      // localStorage unavailable (e.g. private browsing) — fail silently
    }
  }, [darkMode]);

  // Toast auto-clear
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  const handleAccountChange = async (acc: Account) => {
    setActiveAccount(acc);
    try {
      const txnRes = await api.get(`/accounts/${acc.id}/transactions`);
      setTransactions(txnRes.data);
    } catch (err) {
      setError('Failed to load transaction history.');
    }
  };

  // Quick Actions dropdown item handler (Task 1)
  const handleQuickAction = (action: 'transfer' | 'accounts' | 'transactions' | 'assistant') => {
    setQuickActionsOpen(false);
    switch (action) {
      case 'transfer':
        // Reuses the existing inline Transfer UI in the Quick Actions drawer below
        setActiveQuickTab('transfer');
        break;
      case 'accounts':
        navigate(ACCOUNTS_ROUTE);
        break;
      case 'transactions':
        navigate(TRANSACTIONS_ROUTE);
        break;
      case 'assistant':
        // Existing AI Assistant chat input — focus it and bring it into view
        requestAnimationFrame(() => {
          chatInputRef.current?.focus();
          chatInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        break;
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount || !depositAmount) return;
    try {
      await api.post('/transactions/deposit', {
        account_id: activeAccount.id,
        amount: parseFloat(depositAmount)
      });
      setDepositAmount('');
      setSuccessToast('Deposit executed successfully.');
      setActiveQuickTab(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Deposit failed.');
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount || !withdrawAmount) return;
    try {
      await api.post('/transactions/withdraw', {
        account_id: activeAccount.id,
        amount: parseFloat(withdrawAmount)
      });
      setWithdrawAmount('');
      setSuccessToast('Withdrawal completed.');
      setActiveQuickTab(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Withdrawal failed.');
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount || !transferBeneficiary || !transferAmount) return;

    setError('');
    try {
      const amountNum = parseFloat(transferAmount);
      const res = await api.post('/transactions/transfer', {
        account_id: activeAccount.id,
        beneficiary_account_number: transferBeneficiary,
        amount: amountNum,
        confirmed: false
      });

      if (res.data.status === 'confirmation_required') {
        setMediumRiskData({
          risk_score: res.data.risk_score,
          reasons: res.data.reasons || ['Medium Risk Rating Triggered'],
          account_id: activeAccount.id,
          beneficiary_account_number: transferBeneficiary,
          amount: amountNum
        });
        setShowConfirmModal(true);
      } else {
        handleTransferSuccessFeedback(res.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Transfer request blocked.');
    }
  };

  const confirmMediumRiskTransfer = async () => {
    if (!mediumRiskData) return;
    setShowConfirmModal(false);
    setError('');
    try {
      const res = await api.post('/transactions/transfer', {
        account_id: mediumRiskData.account_id,
        beneficiary_account_number: mediumRiskData.beneficiary_account_number,
        amount: mediumRiskData.amount,
        confirmed: true
      });
      handleTransferSuccessFeedback(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Medium risk transfer confirmation failed.');
    } finally {
      setMediumRiskData(null);
    }
  };

  const handleTransferSuccessFeedback = (data: any) => {
    setTransferAmount('');
    setTransferBeneficiary('');
    setActiveQuickTab(null);
    if (data.status === 'PENDING_REVIEW') {
      setSuccessToast(`Transfer suspended for review. Risk Score: ${data.risk_score}. ID: TXN-${data.id}`);
    } else {
      setSuccessToast(`Transfer completed successfully. Transaction ID: TXN-${data.id}`);
    }
    loadData();
  };

  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBeneName || !newBeneAcc) return;
    setError('');
    try {
      await api.post('/accounts/all/beneficiaries', {
        name: newBeneName,
        account_number: newBeneAcc
      });
      setNewBeneName('');
      setNewBeneAcc('');
      setActiveQuickTab(null);
      setSuccessToast('Beneficiary registered successfully.');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add beneficiary.');
    }
  };


  // Review actions (Approve / Reject)
  const handleReviewAction = async (reviewId: number, action: 'approve' | 'reject') => {
    if (processingReviewId !== null) return; // block duplicate/concurrent submissions
    setProcessingReviewId(reviewId);
    setError('');
    setSuccessToast('');
    try {
      const res = await api.post(`/reviews/${reviewId}/${action}`);
      setSuccessToast(res.data.message);
      // Re-fetch from backend so the table, counts, and every row stay in sync
      // with the authoritative server state rather than being patched optimistically.
      await loadData();
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('You are not authorized to approve or reject review requests.');
      } else {
        setError(err.response?.data?.detail || `Failed to ${action} review request.`);
      }
    } finally {
      setProcessingReviewId(null);
    }
  };
  // Chat message sending
  const handleSendChat = async (e: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const textToSend = overrideText || chatInput;
    if (!textToSend.trim()) return;

    if (!overrideText) setChatInput('');

    const newUserMessage: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, newUserMessage]);
    setChatLoading(true);

    try {
      const res = await api.post('/agent/chat', { message: textToSend });
      const { response, status, risk_score, risk_level, transaction } = res.data;

      const newAgentMessage: Message = {
        id: Math.random().toString(),
        sender: 'agent',
        text: response,
        timestamp: new Date(),
        status,
        risk_score,
        risk_level,
        pendingTransfer: status === 'confirmation_required' ? {
          account_id: transaction?.account_id || 1,
          beneficiary_account_number: transaction?.beneficiary?.account_number || '',
          amount: transaction?.amount || 0
        } : undefined
      };

      setChatMessages(prev => [...prev, newAgentMessage]);
      loadData(); // reload balances dynamically
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Sorry, I ran into an error. Please try again.";
      setChatMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'agent',
        text: errorMsg,
        timestamp: new Date(),
        status: 'error'
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleConfirmChatTransfer = async (_msg: Message) => {
    const confirmPrompt = "Yes, please proceed and confirm the transfer.";
    await handleSendChat(null as any, confirmPrompt);
  };

  const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);
  const totalBalanceStr = `₹${totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const totalBalanceFontClass =
    totalBalanceStr.length > 16 ? 'text-lg' :
    totalBalanceStr.length > 13 ? 'text-xl' :
    totalBalanceStr.length > 11 ? 'text-2xl' :
    totalBalanceStr.length > 9 ? 'text-3xl' : 'text-4xl';

  // Review stats
  const pendingReviewsCount = stats?.pending_reviews ?? reviews.filter(r => r.status === 'PENDING').length;
  const approvedReviewsCount = stats?.approved_reviews ?? reviews.filter(r => r.status === 'APPROVED').length;
  const rejectedReviewsCount = stats?.rejected_reviews ?? reviews.filter(r => r.status === 'REJECTED').length;
  const totalReviewedCount = stats?.total_reviews ?? reviews.length;


  if (loading && accounts.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${darkMode ? 'bg-[#0b1120] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <span className={`w-12 h-12 border-4 border-t-transparent rounded-full animate-spin ${darkMode ? 'border-cyan-500' : 'border-blue-600'}`}></span>
      </div>
    );
  }

  return (
    <div className={`dash-root min-h-screen flex ${t.page} ${t.textPrimary}`}>
      <style>{`
        .dash-root, .dash-root * {
          transition-property: background-color, border-color, color, box-shadow, transform;
          transition-duration: 250ms;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dash-root ::-webkit-scrollbar { width: 6px; height: 6px; }
        .dash-root ::-webkit-scrollbar-thumb { background: ${darkMode ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.35)'}; border-radius: 999px; }

        .kpi-card {
          position: relative;
          overflow: hidden;
          transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 280ms cubic-bezier(0.16, 1, 0.3, 1), border-color 280ms ease;
        }
        .kpi-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          opacity: 0;
          transition: opacity 320ms ease;
          pointer-events: none;
        }
        .kpi-card::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          border-radius: inherit;
          opacity: 0;
          transition: opacity 280ms ease;
          background: currentColor;
        }
        .kpi-card:hover::before { opacity: 1; }
        .kpi-card:hover::after { opacity: 0.55; }
        .kpi-card:hover {
          transform: translateY(-4px);
          box-shadow: ${darkMode ? '0 16px 40px -12px rgba(0,0,0,0.55)' : '0 16px 32px -14px rgba(15,23,42,0.18)'};
        }

        .hover-lift { transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 250ms ease, border-color 250ms ease; }
        .hover-lift:hover { transform: translateY(-3px); box-shadow: ${darkMode ? '0 10px 28px -10px rgba(0,0,0,0.5)' : '0 10px 24px -12px rgba(15,23,42,0.15)'}; }
        .hover-lift-sm { transition: transform 220ms ease, box-shadow 220ms ease; }
        .hover-lift-sm:hover { transform: translateY(-2px); box-shadow: ${darkMode ? '0 8px 20px -10px rgba(0,0,0,0.5)' : '0 8px 18px -10px rgba(15,23,42,0.14)'}; }
        .row-hover { transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease; }
        .row-hover:hover { transform: translateX(3px); box-shadow: ${darkMode ? '0 6px 16px -8px rgba(0,0,0,0.45)' : '0 6px 14px -8px rgba(15,23,42,0.12)'}; }

        .premium-card { transition: box-shadow 320ms cubic-bezier(0.16, 1, 0.3, 1), transform 320ms cubic-bezier(0.16, 1, 0.3, 1), border-color 320ms ease; }
        .premium-card:hover {
          transform: translateY(-3px);
          box-shadow: ${darkMode ? '0 24px 60px -20px rgba(0,0,0,0.6)' : '0 24px 48px -20px rgba(15,23,42,0.16)'};
        }

        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.45); }
          70% { box-shadow: 0 0 0 8px rgba(34, 211, 238, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0); }
        }
        .ai-pulse-dark { animation: pulse-ring 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

        @keyframes pulse-ring-light {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.35); }
          70% { box-shadow: 0 0 0 7px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        .ai-pulse-light { animation: pulse-ring-light 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>

      {/* Toast Alert */}
      {successToast && (
        <div className={`fixed bottom-5 right-5 border p-4 rounded-2xl shadow-2xl flex items-center space-x-2.5 animate-bounce z-50 text-xs max-w-md backdrop-blur-sm ${
          darkMode ? 'bg-[#0d1220]/95 border-cyan-500/20 text-cyan-200' : 'bg-white/95 border-blue-500/30 text-blue-700'
        }`}>
          <div className={`p-1 rounded-full shrink-0 ${darkMode ? 'bg-emerald-500/15' : 'bg-green-100'}`}>
            <Check className={`h-4 w-4 ${darkMode ? 'text-emerald-400' : 'text-green-600'}`} />
          </div>
          <span>{successToast}</span>
        </div>
      )}

      {error && (
        <div className={`fixed bottom-5 right-5 border p-4 rounded-2xl shadow-2xl flex items-center space-x-2.5 z-50 text-xs max-w-md backdrop-blur-sm ${
          darkMode ? 'bg-[#0d1220]/95 border-rose-500/30 text-rose-300' : 'bg-white/95 border-red-500/30 text-red-600'
        }`}>
          <div className={`p-1 rounded-full shrink-0 ${darkMode ? 'bg-rose-500/15' : 'bg-red-100'}`}>
            <AlertTriangle className={`h-4 w-4 ${darkMode ? 'text-rose-400' : 'text-red-500'}`} />
          </div>
          <span>{error}</span>
          <button onClick={() => setError('')} className={`ml-2 cursor-pointer ${darkMode ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-900'}`}>✕</button>
        </div>
      )}

      {/* LEFT COLUMN: Sidebar Navigation */}
      <aside className={`w-64 border-r flex flex-col shrink-0 ${t.sidebar}`}>
        <div className={`p-6 border-b flex items-center space-x-3 ${t.divider}`}>
          <div className={`p-2.5 rounded-xl text-white ${
            darkMode
              ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20'
              : 'bg-blue-600 shadow-lg shadow-blue-500/20'
          }`}>
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <span className={`font-extrabold text-lg block leading-tight ${t.textPrimary}`}>Banking AI</span>
            <span className={`text-[9px] tracking-widest font-mono uppercase block ${t.textMuted}`}>SECURE PORTAL</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <div className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>Customer Portal</div>
          <button className={`w-full flex items-center space-x-3 px-3 py-2.5 text-xs font-bold border rounded-xl cursor-pointer transition-all duration-200 ${t.sidebarActive}`}>
            <TrendingUp className={`h-4 w-4 ${darkMode ? 'text-cyan-300' : 'text-blue-600'}`} />
            <span>Dashboard</span>
          </button>
          <button onClick={() => navigate(ACCOUNTS_ROUTE)} className={`w-full flex items-center space-x-3 px-3 py-2.5 text-xs font-semibold border border-transparent rounded-xl cursor-pointer transition-all duration-200 ${t.navIdle} ${t.navHover}`}>
            <CreditCard className={`h-4 w-4 ${t.navIcon}`} />
            <span>Accounts</span>
          </button>
          <button onClick={() => navigate(TRANSACTIONS_ROUTE)} className={`w-full flex items-center space-x-3 px-3 py-2.5 text-xs font-semibold border border-transparent rounded-xl cursor-pointer transition-all duration-200 ${t.navIdle} ${t.navHover}`}>
            <History className={`h-4 w-4 ${t.navIcon}`} />
            <span>Transactions</span>
          </button>
          <button onClick={() => navigate('/assistant')} className={`w-full flex items-center space-x-3 px-3 py-2.5 text-xs font-semibold border border-transparent rounded-xl cursor-pointer transition-all duration-200 ${t.navIdle} ${t.navHover}`}>
            <Bot className={`h-4 w-4 ${t.navIcon}`} />
            <span>AI Assistant</span>
          </button>
        </nav>

        <div className={`p-4 border-t space-y-3 ${t.divider}`}>
          <div className={`flex items-center space-x-3 px-3 py-2 rounded-xl border ${t.cardAlt}`}>
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-cyan-500/10 text-cyan-300' : 'bg-blue-600/10 text-blue-600'}`}>
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="truncate">
              <div className={`text-xs font-bold truncate ${t.textPrimary}`}>{user?.name || "Loading..."}</div>
              <div className={`text-[9px] font-mono tracking-tight uppercase ${t.textSecondary}`}>{user?.role || ""}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className={`w-full font-bold py-2.5 rounded-xl text-xs cursor-pointer flex items-center justify-center space-x-2 border transition-all duration-200 hover:-translate-y-0.5 ${
              darkMode
                ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
                : 'bg-red-50 hover:bg-red-100 border-red-200/60 text-red-600'
            }`}
          >
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* RIGHT CONTAINER: Header + Core grid */}
      <main className={`flex-1 flex flex-col min-w-0 overflow-y-auto p-6 space-y-6 ${t.page}`}>

        {/* TOP ROW: Header details & Metric Cards */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className={`text-2xl font-black tracking-tight leading-none ${t.textPrimary}`}>
              AI-Powered Banking Agent with Guardrails & Human-in-the-Loop
            </h1>
            <p className={`text-xs mt-2 tracking-wide font-medium ${t.textSecondary}`}>
              A 3-Tier Financial Support System with AI Agent, Risk Scoring, Guardrails and Human Review
            </p>
          </div>

          {/* Metric Cards */}
          <div className="flex gap-3 shrink-0 flex-wrap">
            <div className={`kpi-card border px-4 py-4 rounded-2xl flex items-center space-x-3 w-36 cursor-default text-cyan-400 ${t.card}`}
                 style={{
                   backgroundImage: darkMode
                     ? 'linear-gradient(145deg, rgba(34,211,238,0.07), rgba(17,24,39,0) 65%)'
                     : 'linear-gradient(145deg, rgba(37,99,235,0.05), rgba(255,255,255,0) 65%)',
                   boxShadow: darkMode ? '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 20px -14px rgba(0,0,0,0.5)' : '0 1px 0 0 rgba(255,255,255,0.6) inset, 0 8px 18px -14px rgba(15,23,42,0.12)'
                 }}>
              <div className={`p-2.5 rounded-xl border shrink-0 ${darkMode ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-300' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                <Users className="h-5 w-5" />
              </div>
              <div>
                <span className={`text-[9px] uppercase font-bold tracking-wider block leading-none ${t.textMuted}`}>Total Users</span>
                <span className={`text-xl font-black block mt-1.5 tabular-nums ${t.textPrimary}`}>{stats ? stats.total_users.toLocaleString('en-IN') : '—'}</span>
              </div>
            </div>
            <div className={`kpi-card border px-4 py-4 rounded-2xl flex items-center space-x-3 w-40 cursor-default text-emerald-400 ${t.card}`}
                 style={{
                   backgroundImage: darkMode
                     ? 'linear-gradient(145deg, rgba(52,211,153,0.07), rgba(17,24,39,0) 65%)'
                     : 'linear-gradient(145deg, rgba(22,163,74,0.05), rgba(255,255,255,0) 65%)',
                   boxShadow: darkMode ? '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 20px -14px rgba(0,0,0,0.5)' : '0 1px 0 0 rgba(255,255,255,0.6) inset, 0 8px 18px -14px rgba(15,23,42,0.12)'
                 }}>
              <div className={`p-2.5 rounded-xl border shrink-0 ${darkMode ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-green-50 border-green-100 text-green-600'}`}>
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <span className={`text-[9px] uppercase font-bold tracking-wider block leading-none ${t.textMuted}`}>Total Accounts</span>
                <span className={`text-xl font-black block mt-1.5 tabular-nums ${t.textPrimary}`}>{stats ? stats.total_accounts.toLocaleString('en-IN') : '—'}</span>
              </div>
            </div>
            <div className={`kpi-card border px-4 py-4 rounded-2xl flex items-center space-x-3 w-40 cursor-default text-amber-400 ${t.card}`}
                 style={{
                   backgroundImage: darkMode
                     ? 'linear-gradient(145deg, rgba(251,191,36,0.07), rgba(17,24,39,0) 65%)'
                     : 'linear-gradient(145deg, rgba(217,119,6,0.05), rgba(255,255,255,0) 65%)',
                   boxShadow: darkMode ? '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 20px -14px rgba(0,0,0,0.5)' : '0 1px 0 0 rgba(255,255,255,0.6) inset, 0 8px 18px -14px rgba(15,23,42,0.12)'
                 }}>
              <div className={`p-2.5 rounded-xl border shrink-0 ${darkMode ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' : 'bg-yellow-50 border-yellow-100 text-yellow-600'}`}>
                <History className="h-5 w-5" />
              </div>
              <div>
                <span className={`text-[9px] uppercase font-bold tracking-wider block leading-none ${t.textMuted}`}>Transactions</span>
                <span className={`text-xl font-black block mt-1.5 tabular-nums ${t.textPrimary}`}>{stats ? stats.total_transactions.toLocaleString('en-IN') : '—'}</span>
              </div>
            </div>
            <div className={`kpi-card border px-4 py-4 rounded-2xl flex items-center space-x-3 w-40 cursor-default text-rose-400 ${
              darkMode ? 'bg-rose-500/[0.07] border-rose-500/30' : 'bg-red-50/80 border-red-200'
            }`}
                 style={{ boxShadow: darkMode ? '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 20px -14px rgba(190,18,60,0.35)' : '0 1px 0 0 rgba(255,255,255,0.6) inset, 0 8px 18px -14px rgba(220,38,38,0.18)' }}>
              <div className={`p-2.5 rounded-xl border shrink-0 ${darkMode ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' : 'bg-red-100 border-red-200 text-red-500'}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <span className={`text-[9px] uppercase font-bold tracking-wider block leading-none ${darkMode ? 'text-rose-400' : 'text-red-500'}`}>Risk Pending</span>
                <span className={`text-xl font-black block mt-1.5 tabular-nums ${darkMode ? 'text-rose-300' : 'text-red-600'}`}>{pendingReviewsCount}</span>
              </div>
            </div>
          </div>
        </header>

        {/* MIDDLE SECTION: Core columns */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

          {/* COLUMN 1: Customer Dashboard */}
          <div className={`premium-card lg:col-span-4 flex flex-col space-y-5 border rounded-3xl p-6 relative overflow-hidden shadow-sm hover:shadow-xl ${t.card}`}>
            <div className="flex justify-between items-center mb-1">
              <div>
                <h2 className={`text-sm font-bold leading-none ${t.textPrimary}`}>Customer Dashboard</h2>
                <span className={`text-[10px] mt-1.5 block ${t.textSecondary}`}>Welcome back{user?.name ? `, ${user.name}` : ''} 👋</span>
              </div>
              <div ref={quickActionsRef} className="relative">
                <button
                  onClick={() => setQuickActionsOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={quickActionsOpen}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border cursor-pointer hover-lift-sm transition-all duration-200 ${
                    darkMode
                      ? 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500 hover:text-slate-950'
                      : 'text-blue-600 bg-blue-50 border-blue-200/50 hover:bg-blue-600 hover:text-white'
                  }`}
                >
                  Quick Actions
                </button>

                {quickActionsOpen && (
                  <div
                    role="menu"
                    aria-label="Quick Actions"
                    className={`absolute right-0 top-full mt-2 w-52 rounded-xl border shadow-xl z-50 overflow-hidden ${t.card}`}
                  >
                    <button
                      role="menuitem"
                      onClick={() => handleQuickAction('transfer')}
                      className={`w-full text-left px-3.5 py-2.5 text-[11px] font-semibold cursor-pointer border-b transition-colors duration-150 ${t.divider} ${t.textPrimary} ${
                        darkMode ? 'hover:bg-cyan-500/10' : 'hover:bg-blue-50'
                      }`}
                    >
                      Transfer Money
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => handleQuickAction('accounts')}
                      className={`w-full text-left px-3.5 py-2.5 text-[11px] font-semibold cursor-pointer border-b transition-colors duration-150 ${t.divider} ${t.textPrimary} ${
                        darkMode ? 'hover:bg-cyan-500/10' : 'hover:bg-blue-50'
                      }`}
                    >
                      View Accounts
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => handleQuickAction('transactions')}
                      className={`w-full text-left px-3.5 py-2.5 text-[11px] font-semibold cursor-pointer border-b transition-colors duration-150 ${t.divider} ${t.textPrimary} ${
                        darkMode ? 'hover:bg-cyan-500/10' : 'hover:bg-blue-50'
                      }`}
                    >
                      View Transactions
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => handleQuickAction('assistant')}
                      className={`w-full text-left px-3.5 py-2.5 text-[11px] font-semibold cursor-pointer transition-colors duration-150 ${t.textPrimary} ${
                        darkMode ? 'hover:bg-cyan-500/10' : 'hover:bg-blue-50'
                      }`}
                    >
                      Ask AI Assistant
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions tab drawer */}
            {activeQuickTab && (
              <div className={`p-4 rounded-2xl relative space-y-4 border ${t.cardAlt}`}>
                <div className={`flex justify-between items-center border-b pb-2 ${t.divider}`}>
                  <span className={`text-xs font-bold uppercase ${t.textSecondary}`}>Quick Actions Panel</span>
                  <button onClick={() => setActiveQuickTab(null)} className={`cursor-pointer ${darkMode ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-900'}`}>✕</button>
                </div>

                <div className="flex gap-2 justify-between">
                  {(['deposit', 'withdraw', 'transfer', 'add_beneficiary'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveQuickTab(tab)}
                      className={`flex-1 text-[10px] font-bold py-1.5 px-2 rounded-lg border cursor-pointer transition-all duration-200 ${
                        activeQuickTab === tab
                          ? (darkMode ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-blue-600 text-white border-blue-500')
                          : (darkMode ? 'bg-[#0a0e18] text-slate-400 border-slate-800' : 'bg-white text-slate-600 border-slate-200')
                      }`}
                    >
                      {tab === 'deposit' ? 'Deposit' : tab === 'withdraw' ? 'Withdraw' : tab === 'transfer' ? 'Transfer' : '+ Beneficiary'}
                    </button>
                  ))}
                </div>

                {activeQuickTab === 'deposit' && (
                  <form onSubmit={handleDeposit} className="space-y-2">
                    <input
                      type="number"
                      placeholder="Amount to Deposit"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs outline-none ${t.input}`}
                      required
                    />
                    <button type="submit" className={`w-full font-bold py-2 rounded-xl text-xs text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${darkMode ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-blue-600 hover:bg-blue-500'}`}>Execute Deposit</button>
                  </form>
                )}

                {activeQuickTab === 'withdraw' && (
                  <form onSubmit={handleWithdraw} className="space-y-2">
                    <input
                      type="number"
                      placeholder="Amount to Withdraw"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs outline-none ${t.input}`}
                      required
                    />
                    <button type="submit" className={`w-full font-bold py-2 rounded-xl text-xs text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${darkMode ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-blue-600 hover:bg-blue-500'}`}>Execute Withdrawal</button>
                  </form>
                )}

                {activeQuickTab === 'transfer' && (
                  <form onSubmit={handleTransfer} className="space-y-2">
                    <select
                      value={transferBeneficiary}
                      onChange={(e) => setTransferBeneficiary(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs outline-none ${t.input}`}
                      required
                    >
                      <option value="">Select Beneficiary</option>
                      {beneficiaries.map(b => (
                        <option key={b.id} value={b.account_number}>
                          {b.name} ({b.account_number}) - {b.is_verified ? "Verified" : "Unverified"}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Amount"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs outline-none ${t.input}`}
                      required
                    />
                    <button type="submit" className={`w-full font-bold py-2 rounded-xl text-xs text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${darkMode ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-blue-600 hover:bg-blue-500'}`}>Send Transfer</button>
                  </form>
                )}

                {activeQuickTab === 'add_beneficiary' && (
                  <form onSubmit={handleAddBeneficiary} className="space-y-2">
                    <input
                      type="text"
                      placeholder="Beneficiary Name"
                      value={newBeneName}
                      onChange={(e) => setNewBeneName(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs outline-none ${t.input}`}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Account Number (8 digits)"
                      value={newBeneAcc}
                      onChange={(e) => setNewBeneAcc(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs outline-none ${t.input}`}
                      required
                    />
                    <button type="submit" className={`w-full font-bold py-2 rounded-xl text-xs text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${darkMode ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-blue-600 hover:bg-blue-500'}`}>Add Beneficiary</button>
                  </form>
                )}
              </div>
            )}

            {/* Total Balance card */}
            <div className={`p-6 rounded-2xl flex justify-between items-center gap-4 relative overflow-hidden text-white transition-all duration-300 ease-out hover:-translate-y-1 ${
              darkMode
                ? 'bg-gradient-to-br from-[#101f45] via-[#0b1530] to-[#060b1a] border border-cyan-500/25 shadow-[0_0_55px_-12px_rgba(34,211,238,0.45),0_24px_48px_-24px_rgba(0,0,0,0.6)] hover:shadow-[0_0_70px_-10px_rgba(34,211,238,0.55),0_28px_56px_-20px_rgba(0,0,0,0.65)]'
                : 'bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 shadow-xl shadow-blue-900/25 hover:shadow-2xl hover:shadow-blue-900/35'
            }`}>
              <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl ${darkMode ? 'bg-cyan-400/15' : 'bg-white/10'}`}></div>
              <div className={`absolute -bottom-8 -left-8 w-32 h-32 rounded-full blur-3xl ${darkMode ? 'bg-blue-500/15' : 'bg-indigo-400/10'}`}></div>
               <div className="relative min-w-0 flex-1">
                <span className={`text-[10px] uppercase font-bold flex items-center gap-1.5 tracking-wider ${darkMode ? 'text-cyan-300/80' : 'text-blue-200'}`}>
                  <Sparkles className="h-3 w-3" />
                  Total Balance
                </span>
                <span className={`${totalBalanceFontClass} font-black block mt-3 text-white font-sans tracking-tight tabular-nums whitespace-nowrap leading-tight`}>
                  {totalBalanceStr}
                </span>
                <span className={`text-[9px] mt-3 inline-block font-semibold px-2 py-0.5 rounded-full ${darkMode ? 'bg-cyan-400/10 text-cyan-200/80 border border-cyan-400/20' : 'bg-white/10 text-blue-100 border border-white/10'}`}>
                  Across {accounts.length} Accounts
                </span>
              </div>
              <div className={`relative p-2.5 sm:p-3.5 rounded-2xl text-white shrink-0 ${darkMode ? 'bg-white/[0.06] border border-cyan-400/25 shadow-[0_0_25px_-8px_rgba(34,211,238,0.6)]' : 'bg-white/15 border border-white/10'}`}>
                <Wallet className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
            </div>

            {/* Accounts list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${t.textMuted}`}>My Accounts</span>
                <button onClick={() => navigate(ACCOUNTS_ROUTE)} className={`text-[9px] font-bold hover:underline cursor-pointer ${darkMode ? 'text-cyan-400' : 'text-blue-600'}`}>View All</button>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {accounts.length > 0 ? (
                  accounts.map((acc) => (
                    <div
                      key={acc.id}
                      onClick={() => handleAccountChange(acc)}
                      className={`hover-lift border p-3.5 rounded-xl cursor-pointer flex flex-col justify-between h-24 ${
                        activeAccount?.id === acc.id
                          ? (darkMode
                              ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200 shadow-[0_0_20px_-6px_rgba(34,211,238,0.5)] ring-1 ring-cyan-500/25'
                              : 'bg-blue-50 border-blue-500/70 text-blue-700 shadow-[0_4px_14px_-6px_rgba(37,99,235,0.25)] ring-1 ring-blue-500/15')
                          : (darkMode
                              ? 'bg-[#0a0e18] border-slate-800 text-slate-400 hover:border-cyan-500/30 hover:bg-[#0d1424]'
                              : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-white')
                      }`}
                    >
                      <div>
                        <span className="text-[9px] font-bold block truncate uppercase tracking-tight">
                          {acc.account_type === 'CHECKING' ? 'Current Acc' : acc.account_type === 'SAVINGS' ? 'Savings Acc' : 'Salary Acc'}
                        </span>
                        <span className={`text-[8px] font-mono block mt-0.5 ${t.textMuted}`}>•••• {acc.account_number.slice(-4)}</span>
                      </div>
                      <span className={`text-[11px] font-extrabold block mt-2 font-sans tabular-nums ${t.textPrimary}`}>
                        ₹{acc.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className={`col-span-3 border p-4 rounded-xl text-center text-[10px] ${t.cardAlt} ${t.textMuted}`}>
                    No accounts found.
                  </div>
                )}
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="flex-1 flex flex-col min-h-[160px]">
              <div className="flex justify-between items-center mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>Recent Transactions</span>
                <button onClick={loadData} className={`text-[9px] font-bold hover:underline cursor-pointer ${darkMode ? 'text-cyan-400' : 'text-blue-600'}`}>View All</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[180px] pr-1">
                {transactions.length > 0 ? (
                  transactions.slice(0, 4).map((txn) => {
                    const isCredit = txn.type === 'DEPOSIT';
                    return (
                      <div key={txn.id} className={`row-hover border rounded-xl p-3 flex items-center justify-between ${
                        darkMode ? 'bg-[#0a0e18] border-slate-800 hover:border-cyan-500/30' : 'bg-slate-50 border-slate-200 hover:border-blue-300'
                      }`}>
                        <div className="flex items-center space-x-3">
                          <div className={`p-1.5 rounded-lg ${
                            isCredit
                              ? (darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-green-100 text-green-700')
                              : (darkMode ? 'bg-rose-500/10 text-rose-400' : 'bg-red-50 text-red-500')
                          }`}>
                            {isCredit ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                          </div>
                          <div>
                            <span className={`text-[10px] font-bold block ${t.textPrimary}`}>
                              {txn.type === 'TRANSFER' ? 'Transfer Outbound' : txn.type === 'WITHDRAW' ? 'Cash Withdrawal' : 'Deposit Received'}
                            </span>
                            <span className={`text-[8px] block font-mono mt-0.5 ${t.textMuted}`}>
                              {new Date(txn.created_at).toLocaleDateString()} | TXN-{txn.id}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold tabular-nums ${isCredit ? (darkMode ? 'text-emerald-400' : 'text-green-600') : (darkMode ? 'text-rose-400' : 'text-red-500')}`}>
                          {isCredit ? '+' : '-'} ₹{txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className={`border rounded-xl p-4 text-center text-[10px] ${t.cardAlt} ${t.textMuted}`}>
                    No transactions found.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COLUMN 2: AI Banking Assistant */}
          <div className={`premium-card lg:col-span-4 flex flex-col border rounded-3xl p-6 relative overflow-hidden h-[540px] shadow-sm hover:shadow-xl ${
            darkMode ? 'bg-[#111827] border-cyan-500/20 shadow-[0_0_60px_-18px_rgba(34,211,238,0.35)]' : 'bg-white border-blue-200/60'
          }`}>
            {/* Ambient AI glow accent (dark mode only) */}
            {darkMode && (
              <>
                <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl bg-cyan-500/15 pointer-events-none"></div>
                <div className="absolute -bottom-20 -left-16 w-56 h-56 rounded-full blur-3xl bg-blue-500/10 pointer-events-none"></div>
              </>
            )}

            <div className={`flex justify-between items-center border-b pb-3 mb-3 shrink-0 relative ${t.divider}`}>
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-xl border ${
                  darkMode
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 shadow-[0_0_18px_-3px_rgba(34,211,238,0.7)]'
                    : 'bg-blue-50 border-blue-100 text-blue-600'
                }`}>
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className={`text-xs font-bold leading-none flex items-center gap-1.5 ${t.textPrimary}`}>
                    AI Banking Assistant
                  </h2>
                  <span className={`text-[8px] mt-1.5 flex items-center gap-1.5 font-semibold uppercase tracking-wide ${darkMode ? 'text-emerald-400' : 'text-green-600'}`}>
                    <span className={`relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400 ${darkMode ? 'ai-pulse-dark' : 'ai-pulse-light'}`}></span>
                    Shield &amp; Guardrails Active
                  </span>
                </div>
              </div>

              <button
                onClick={() => setDarkMode(!darkMode)}
                style={{ width: '52px', height: '28px' }}
                className={`relative shrink-0 rounded-full border-2 cursor-pointer transition-all duration-200 ${
                  darkMode
                    ? 'bg-gradient-to-r from-slate-800 to-slate-900 border-cyan-500/40'
                    : 'bg-slate-200 border-slate-300'
                }`}
                aria-label="Toggle dark mode"
              >
                <span
                  style={{ width: '20px', height: '20px', top: '2px', left: darkMode ? '28px' : '2px', transition: 'left 250ms cubic-bezier(0.4,0,0.2,1)' }}
                  className={`absolute rounded-full flex items-center justify-center shadow ${
                    darkMode ? 'bg-slate-950 text-cyan-300 shadow-cyan-500/30' : 'bg-white text-blue-600'
                  }`}
                >
                  {darkMode ? (
                    <Moon className="w-3 h-3" />
                  ) : (
                    <Sun className="w-3 h-3" />
                  )}
                </span>
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 flex flex-col relative">
              {chatMessages.map((msg) => {
                const isAgent = msg.sender === 'agent';
                return (
                  <div key={msg.id} className={`flex items-start gap-2.5 ${isAgent ? 'justify-start' : 'justify-end'}`}>
                    {isAgent && (
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 border ${darkMode ? 'bg-[#0a0e18] border-cyan-500/20 text-cyan-300' : 'bg-slate-50 border-slate-200 text-blue-600'}`}>
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                    )}

                    <div className="max-w-[85%] space-y-1.5">
                      <div className={`p-3 rounded-2xl text-[11px] leading-relaxed backdrop-blur-sm transition-all duration-200 ${
                        isAgent
                          ? (darkMode ? 'bg-[#0a0e18]/90 border border-slate-800 text-slate-300 rounded-tl-md shadow-[0_4px_18px_-8px_rgba(0,0,0,0.5)]' : 'bg-slate-50 border border-slate-200 text-slate-800 shadow-sm rounded-tl-md')
                          : (darkMode ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20 rounded-tr-md' : 'bg-blue-600 text-white shadow-sm rounded-tr-md')
                      }`}>
                        <p className="whitespace-pre-line">{msg.text}</p>

                        {/* If Agent message has validation checks list (replicates screenshot checklist) */}
                        {isAgent && msg.risk_score != null && (
                          <div className={`mt-3 pt-2.5 border-t space-y-1.5 text-[9px] font-medium ${t.divider} ${t.textSecondary}`}>
                            <div className="flex items-center space-x-1.5">
                              <Check className={`h-3 w-3 ${darkMode ? 'text-emerald-400' : 'text-green-600'}`} />
                              <span>Validating account details</span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <Check className={`h-3 w-3 ${darkMode ? 'text-emerald-400' : 'text-green-600'}`} />
                              <span>Checking available balance</span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <Check className={`h-3 w-3 ${darkMode ? 'text-emerald-400' : 'text-green-600'}`} />
                              <span>Calculating risk score</span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <Check className={`h-3 w-3 ${darkMode ? 'text-emerald-400' : 'text-green-600'}`} />
                              <span>Applying guardrails</span>
                            </div>

                            {/* Score badge — AI/security status style */}
                            <div className="mt-2.5 flex items-center">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold uppercase tracking-wider text-[8px] border ${
                                msg.status === 'review_required'
                                  ? (darkMode ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-red-50 text-red-600 border-red-200/50')
                                  : msg.status === 'confirmation_required'
                                  ? (darkMode ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-yellow-50 text-yellow-700 border-yellow-200/50')
                                  : (darkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-green-50 text-green-700 border-green-200/50')
                              }`}>
                                <ShieldCheck className="h-2.5 w-2.5" />
                                Risk Score: {msg.risk_score} ({msg.risk_level || "LOW RISK"})
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Confirmation actions inline */}
                        {isAgent && msg.status === 'confirmation_required' && msg.pendingTransfer && (
                          <div className="mt-3 flex items-center space-x-2">
                            <button
                              onClick={() => handleConfirmChatTransfer(msg)}
                              className={`font-extrabold px-3 py-1.5 rounded-lg text-[9px] cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                                darkMode ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-yellow-600 hover:bg-yellow-500 text-black'
                              }`}
                            >
                              Confirm Action
                            </button>
                            <button
                              onClick={() => handleSendChat(null as any, "No, cancel this transfer.")}
                              className={`font-bold px-3 py-1.5 rounded-lg text-[9px] cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                                darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              }`}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      <span className={`text-[7px] font-mono tracking-tighter uppercase block px-1 ${t.textMuted}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
              {chatLoading && (
                <div className="flex items-start gap-2.5">
                  <div className={`p-1.5 rounded-lg shrink-0 border ${darkMode ? 'bg-[#0a0e18] border-cyan-500/20 text-cyan-300' : 'bg-slate-50 border-slate-200 text-blue-600'}`}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <div className={`p-3 rounded-2xl text-[10px] italic border flex items-center gap-2 ${darkMode ? 'bg-[#0a0e18] border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <Activity className="h-3 w-3 animate-pulse" />
                    Agent is processing transaction guardrails...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input field */}
            <form onSubmit={(e) => handleSendChat(e)} className={`flex items-center space-x-2 shrink-0 border-t pt-3 ${t.divider}`}>
              <input
                ref={chatInputRef}
                type="text"
                placeholder="Ask assistant to execute a transfer, query balance..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatLoading}
                className={`flex-1 rounded-xl px-4 py-2.5 text-xs outline-none transition-all duration-200 ${t.input}`}
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className={`p-2.5 rounded-xl cursor-pointer text-white transition-all duration-200 hover:-translate-y-0.5 ${
                  darkMode
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 shadow shadow-cyan-500/30'
                    : 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 shadow-sm'
                }`}
              >
                <SendIcon className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {/* COLUMN 3: Admin - High Risk Reviews */}
          <div className={`premium-card lg:col-span-4 flex flex-col border rounded-3xl p-6 relative overflow-hidden h-[540px] shadow-sm hover:shadow-xl ${t.card}`}>
            <div>
              <div className="flex justify-between items-center mb-1">
                <h2 className={`text-sm font-bold leading-none ${t.textPrimary}`}>Admin - High Risk Reviews</h2>
                <button
                  onClick={loadData}
                  className={`text-[9px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer transition-all duration-200 ${
                    darkMode
                      ? 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500 hover:text-slate-950'
                      : 'text-blue-600 bg-blue-50 border-blue-200/50 hover:bg-blue-600 hover:text-white'
                  }`}
                >
                  Review Queue
                </button>
              </div>
              <span className={`text-[10px] ${t.textSecondary}`}>Compliance queue logs showing suspended transfers</span>
            </div>

            {/* Statistics Mini Cards */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              <div className={`hover-lift-sm border p-2.5 rounded-xl text-center relative overflow-hidden ${t.cardAlt}`}>
                <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-xl ${darkMode ? 'bg-gradient-to-r from-amber-500/20 via-amber-400 to-amber-500/20' : 'bg-gradient-to-r from-yellow-500/20 via-yellow-500 to-yellow-500/20'}`}></div>
                <span className={`text-[7px] font-bold block uppercase leading-none mb-1.5 ${darkMode ? 'text-amber-400' : 'text-yellow-600'}`}>Pending</span>
                <span className={`text-base font-black tabular-nums ${t.textPrimary}`}>{pendingReviewsCount}</span>
              </div>
              <div className={`hover-lift-sm border p-2.5 rounded-xl text-center relative overflow-hidden ${t.cardAlt}`}>
                <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-xl ${darkMode ? 'bg-gradient-to-r from-emerald-500/20 via-emerald-400 to-emerald-500/20' : 'bg-gradient-to-r from-green-500/20 via-green-500 to-green-500/20'}`}></div>
                <span className={`text-[7px] font-bold block uppercase leading-none mb-1.5 ${darkMode ? 'text-emerald-400' : 'text-green-700'}`}>Approved</span>
                <span className={`text-base font-black tabular-nums ${t.textPrimary}`}>{approvedReviewsCount}</span>
              </div>
              <div className={`hover-lift-sm border p-2.5 rounded-xl text-center relative overflow-hidden ${t.cardAlt}`}>
                <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-xl ${darkMode ? 'bg-gradient-to-r from-rose-500/20 via-rose-400 to-rose-500/20' : 'bg-gradient-to-r from-red-500/20 via-red-500 to-red-500/20'}`}></div>
                <span className={`text-[7px] font-bold block uppercase leading-none mb-1.5 ${darkMode ? 'text-rose-400' : 'text-red-600'}`}>Rejected</span>
                <span className={`text-base font-black tabular-nums ${t.textPrimary}`}>{rejectedReviewsCount}</span>
              </div>
              <div className={`hover-lift-sm border p-2.5 rounded-xl text-center relative overflow-hidden ${t.cardAlt}`}>
                <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-xl ${darkMode ? 'bg-gradient-to-r from-slate-700/40 via-slate-500 to-slate-700/40' : 'bg-gradient-to-r from-slate-300/50 via-slate-400 to-slate-300/50'}`}></div>
                <span className={`text-[7px] font-bold block uppercase leading-none mb-1.5 ${t.textMuted}`}>Reviewed</span>
                <span className={`text-base font-black tabular-nums ${t.textPrimary}`}>{totalReviewedCount}</span>
              </div>
            </div>

            {/* Queue Table */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[340px] mt-3 min-w-0">
              <table className={`w-full max-w-full text-[10px] text-left border-separate border-spacing-0 table-fixed ${t.textSecondary}`}>
                <colgroup>
                  <col className="w-[13%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[32%]" />
                </colgroup>
                <thead className={`text-[8px] uppercase border-b tracking-wider font-bold sticky top-0 ${t.divider} ${t.textMuted} ${darkMode ? 'bg-[#111827]' : 'bg-white'}`}>
                  <tr>
                    <th className="py-2.5 pl-1 pr-1">Txn ID</th>
                    <th className="py-2.5 px-1">Customer</th>
                    <th className="py-2.5 px-1">Amount</th>
                    <th className="py-2.5 px-1 text-center">Score</th>
                    <th className="py-2.5 px-1">Status</th>
                    <th className="py-2.5 pl-1 pr-0 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className={darkMode ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                  {reviews.length > 0 ? (
                    reviews.map((rev) => {
                      const amount = rev.transaction?.amount || 0;
                      const score = rev.transaction?.risk_score || 70;
                      const name = rev.transaction?.account?.user?.name || "Customer";
                      const isPending = rev.status === 'PENDING';

                      return (
                        <tr key={rev.id} className={`row-hover transition-all duration-200 ${darkMode ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/70'}`}>
                          <td className={`py-2.5 pl-1 pr-1 font-mono font-semibold truncate ${t.textPrimary}`}>TXN-{rev.transaction_id}</td>
                          <td className="py-2.5 px-1 truncate font-medium" title={name}>{name}</td>
                          <td className={`py-2.5 px-1 font-sans font-bold tabular-nums truncate ${t.textPrimary}`}>₹{amount.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-1 text-center">
                            <span className={`inline-flex items-center gap-1 px-1 py-0.5 rounded-md font-mono font-bold border ${
                              score >= 80
                                ? (darkMode ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' : 'text-red-600 bg-red-50 border-red-200/50')
                                : (darkMode ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-yellow-600 bg-yellow-50 border-yellow-200/50')
                            }`}>
                              <span className={`w-1 h-1 rounded-full shrink-0 ${score >= 80 ? (darkMode ? 'bg-rose-400' : 'bg-red-500') : (darkMode ? 'bg-amber-400' : 'bg-yellow-500')}`}></span>
                              {score}
                            </span>
                          </td>
                          <td className="py-2.5 px-1 truncate">
                            <span className={`inline-flex items-center gap-1 font-mono font-bold text-[8px] uppercase tracking-wider ${
                              isPending
                                ? (darkMode ? 'text-amber-400' : 'text-yellow-600 font-extrabold')
                                : rev.status === 'APPROVED'
                                ? (darkMode ? 'text-emerald-400' : 'text-green-600')
                                : (darkMode ? 'text-rose-400' : 'text-red-500')
                            }`}>
                              {rev.status}
                            </span>
                          </td>
                          <td className="py-2.5 pl-1 pr-0 align-middle">
                            {isPending ? (
                              <div className="flex justify-end items-center gap-1 w-full">
                                <button
                                  onClick={() => handleReviewAction(rev.id, 'approve')}
                                  disabled={processingReviewId !== null}
                                  className={`flex-1 min-w-0 max-w-[52px] text-center text-[7px] font-extrabold border px-1 py-1 rounded-md whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-200 ${
                                    processingReviewId !== null
                                      ? 'opacity-40 cursor-not-allowed'
                                      : 'cursor-pointer hover:-translate-y-0.5'
                                  } ${
                                    darkMode
                                      ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400'
                                      : 'bg-green-50 border-green-200 hover:bg-green-600 hover:text-white text-green-700'
                                  }`}
                                >
                                  {processingReviewId === rev.id ? '...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => handleReviewAction(rev.id, 'reject')}
                                  disabled={processingReviewId !== null}
                                  className={`flex-1 min-w-0 max-w-[52px] text-center text-[7px] font-extrabold border px-1 py-1 rounded-md whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-200 ${
                                    processingReviewId !== null
                                      ? 'opacity-40 cursor-not-allowed'
                                      : 'cursor-pointer hover:-translate-y-0.5'
                                  } ${
                                    darkMode
                                      ? 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500 hover:text-white text-rose-400'
                                      : 'bg-red-50 border-red-200 hover:bg-red-500 hover:text-white text-red-600'
                                  }`}
                                >
                                  {processingReviewId === rev.id ? '...' : 'Reject'}
                                </button>
                              </div>
                            ) : (
                              <span className={`font-bold block text-right ${t.textMuted}`}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className={`py-8 text-center italic ${t.textMuted}`}>No reviews currently pending compliance audits.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </main>

      {/* CONFIRMATION MODAL (Medium Risk override - manual route) */}
      {showConfirmModal && mediumRiskData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`border rounded-3xl p-6 max-w-md w-full shadow-2xl relative ${
            darkMode ? 'bg-[#111827] border-amber-500/25' : 'bg-white border-yellow-500/30'
          }`}>
            <div className="flex items-center space-x-3 mb-4">
              <div className={`p-2 rounded-xl ${darkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-yellow-50 text-yellow-600'}`}>
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className={`text-sm font-bold leading-none ${t.textPrimary}`}>Medium Risk Override Prompt</h3>
                <span className={`text-[9px] mt-1 block ${t.textSecondary}`}>Security verification warning required</span>
              </div>
            </div>

            <p className={`text-xs leading-relaxed mb-4 ${t.textSecondary}`}>
              This transfer of <strong className={t.textPrimary}>₹{mediumRiskData.amount.toLocaleString()}</strong> to beneficiary account <strong className={t.textPrimary}>{mediumRiskData.beneficiary_account_number}</strong> triggers medium risk parameters:
            </p>

            <div className={`p-3 rounded-2xl mb-4 space-y-1.5 border ${t.cardAlt}`}>
              {mediumRiskData.reasons.map((r, i) => (
                <div key={i} className={`flex items-start space-x-2 text-[9px] leading-tight ${darkMode ? 'text-amber-400' : 'text-yellow-700'}`}>
                  <span className="mt-0.5">•</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>

            <p className={`text-[10px] mb-4 ${t.textSecondary}`}>
              Do you authorize this transaction? If yes, click Confirm.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={confirmMediumRiskTransfer}
                className={`flex-1 font-extrabold py-2.5 rounded-xl text-xs cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                  darkMode ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-yellow-600 hover:bg-yellow-500 text-black'
                }`}
              >
                Confirm Override
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setMediumRiskData(null);
                }}
                className={`flex-1 font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                  darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;