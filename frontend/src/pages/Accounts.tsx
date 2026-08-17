import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, CreditCard, Wallet, ShieldCheck, AlertTriangle, Loader2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface Account {
  id: number;
  account_number: string;
  account_type: string;
  balance: number;
  status: string;
}

interface Transaction {
  id: number;
  type: 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER';
  amount: number;
  status: string;
  created_at: string;
}

const readStoredDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('darkMode') === 'true';
  } catch {
    return false;
  }
};

const accountLabel = (type: string): string => {
  if (type === 'CHECKING') return 'Current Account';
  if (type === 'SAVINGS') return 'Savings Account';
  if (type === 'SALARY') return 'Salary Account';
  return type;
};

const statusStyles = (status: string, darkMode: boolean) => {
  switch (status) {
    case 'BLOCKED':
      return darkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-red-50 border-red-200 text-red-600';
    case 'PENDING':
      return darkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-yellow-50 border-yellow-200 text-yellow-700';
    case 'CLOSED':
      return darkMode ? 'bg-slate-700/30 border-slate-600/40 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-500';
    default: // ACTIVE
      return darkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-green-50 border-green-200 text-green-700';
  }
};

export const Accounts: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState<boolean>(readStoredDarkMode);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Per-account expandable transaction history
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [txnCache, setTxnCache] = useState<Record<number, Transaction[]>>({});
  const [txnLoading, setTxnLoading] = useState<number | null>(null);
  const [txnError, setTxnError] = useState<Record<number, string>>({});

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'darkMode') setDarkMode(readStoredDarkMode());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Same endpoint the Dashboard already calls — no new API invented.
      const res = await api.get('/accounts');
      setAccounts(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const toggleExpand = async (accountId: number) => {
    if (expandedId === accountId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(accountId);

    if (!txnCache[accountId]) {
      setTxnLoading(accountId);
      setTxnError(prev => ({ ...prev, [accountId]: '' }));
      try {
        // Reuses the existing per-account transactions endpoint — no new API.
        const res = await api.get(`/accounts/${accountId}/transactions`);
        setTxnCache(prev => ({ ...prev, [accountId]: res.data.slice(0, 5) }));
      } catch (err: any) {
        setTxnError(prev => ({
          ...prev,
          [accountId]: err.response?.data?.detail || 'Failed to load transactions.'
        }));
      } finally {
        setTxnLoading(null);
      }
    }
  };

  const t = {
    page: darkMode ? 'bg-[#0b1120]' : 'bg-slate-50',
    card: darkMode ? 'bg-[#111827] border-slate-800/80' : 'bg-white border-slate-200',
    cardAlt: darkMode ? 'bg-[#0a0e18] border-slate-800/70' : 'bg-slate-50 border-slate-200',
    textPrimary: darkMode ? 'text-slate-100' : 'text-slate-900',
    textSecondary: darkMode ? 'text-slate-400' : 'text-slate-500',
    textMuted: darkMode ? 'text-slate-600' : 'text-slate-400',
    divider: darkMode ? 'border-slate-800/80' : 'border-slate-200',
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className={`min-h-screen ${t.page} ${t.textPrimary}`}>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              className={`p-2 rounded-xl border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${t.card}`}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none">My Accounts</h1>
              <p className={`text-xs mt-1.5 ${t.textSecondary}`}>All accounts linked to {user?.name || 'your profile'}</p>
            </div>
          </div>
          <div className={`px-4 py-2.5 rounded-xl border text-right ${t.card}`}>
            <span className={`text-[9px] uppercase font-bold tracking-wider block ${t.textMuted}`}>Total Balance</span>
            <span className="text-lg font-black tabular-nums block mt-0.5">
              ₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {error && (
          <div className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            darkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </span>
            <button
              onClick={loadAccounts}
              className={`shrink-0 flex items-center gap-1.5 font-bold px-3 py-1.5 rounded-lg border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                darkMode ? 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500 hover:text-white' : 'bg-white border-red-300 hover:bg-red-600 hover:text-white'
              }`}
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className={`h-8 w-8 animate-spin ${darkMode ? 'text-cyan-500' : 'text-blue-600'}`} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => {
              const isExpanded = expandedId === acc.id;
              return (
                <div
                  key={acc.id}
                  className={`border rounded-2xl p-5 space-y-4 shadow-sm transition-all duration-200 hover:shadow-lg ${t.card}`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl border ${
                      darkMode ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300' : 'bg-blue-50 border-blue-100 text-blue-600'
                    }`}>
                      {acc.account_type === 'CHECKING' ? <CreditCard className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${statusStyles(acc.status, darkMode)}`}>
                      <ShieldCheck className="h-2.5 w-2.5" />
                      {acc.status}
                    </span>
                  </div>

                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-wide block ${t.textMuted}`}>
                      {accountLabel(acc.account_type)}
                    </span>
                    <span className={`text-[11px] font-mono block mt-1 ${t.textSecondary}`}>
                      •••• {acc.account_number.slice(-4)}
                    </span>
                  </div>

                  <div>
                    <span className={`text-[9px] uppercase font-bold tracking-wide block ${t.textMuted}`}>Available Balance</span>
                    <span className="text-2xl font-black tabular-nums block mt-1">
                      ₹{acc.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    onClick={() => toggleExpand(acc.id)}
                    className={`w-full flex items-center justify-center gap-1.5 text-[10px] font-bold py-2 rounded-xl border cursor-pointer transition-all duration-200 ${t.cardAlt} ${t.textSecondary}`}
                  >
                    {isExpanded ? 'Hide' : 'View'} Recent Transactions
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {isExpanded && (
                    <div className={`pt-3 border-t space-y-2 ${t.divider}`}>
                      {txnLoading === acc.id ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className={`h-4 w-4 animate-spin ${darkMode ? 'text-cyan-500' : 'text-blue-600'}`} />
                        </div>
                      ) : txnError[acc.id] ? (
                        <div className={`text-[10px] text-center py-2 ${darkMode ? 'text-rose-400' : 'text-red-500'}`}>
                          {txnError[acc.id]}
                        </div>
                      ) : (txnCache[acc.id]?.length ?? 0) === 0 ? (
                        <div className={`text-[10px] text-center py-2 italic ${t.textMuted}`}>
                          No transactions found.
                        </div>
                      ) : (
                        txnCache[acc.id].map((txn) => {
                          const isCredit = txn.type === 'DEPOSIT';
                          return (
                            <div key={txn.id} className="flex items-center justify-between text-[10px]">
                              <span className={t.textSecondary}>
                                {txn.type} · {new Date(txn.created_at).toLocaleDateString()}
                              </span>
                              <span className={`font-bold tabular-nums ${isCredit ? (darkMode ? 'text-emerald-400' : 'text-green-600') : (darkMode ? 'text-rose-400' : 'text-red-500')}`}>
                                {isCredit ? '+' : '-'} ₹{txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {accounts.length === 0 && (
              <div className={`col-span-full text-center py-16 italic text-sm ${t.textMuted}`}>
                No accounts found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Accounts;