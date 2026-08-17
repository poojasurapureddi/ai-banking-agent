import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, ArrowUpRight, ArrowDownRight, ShieldCheck, AlertTriangle,
  Loader2, RefreshCw, Search, ChevronDown, ChevronUp
} from 'lucide-react';

interface Transaction {
  id: number;
  account_id: number;
  account_number: string;
  beneficiary_id?: number;
  type: 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER';
  amount: number;
  status: 'PENDING_REVIEW' | 'SUCCESS' | 'REJECTED' | 'FAILED';
  risk_score: number;
  risk_reason?: string;
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

const typeLabel = (type: string): string => {
  if (type === 'TRANSFER') return 'Transfer Outbound';
  if (type === 'WITHDRAW') return 'Cash Withdrawal';
  return 'Deposit Received';
};

const statusStyles = (status: string, darkMode: boolean) => {
  switch (status) {
    case 'PENDING_REVIEW':
      return darkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-yellow-50 border-yellow-200 text-yellow-700';
    case 'REJECTED':
    case 'FAILED':
      return darkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-red-50 border-red-200 text-red-600';
    default: // SUCCESS
      return darkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-green-50 border-green-200 text-green-700';
  }
};

const PAGE_SIZE = 20;

export const Transactions: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState<boolean>(readStoredDarkMode);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'darkMode') setDarkMode(readStoredDarkMode());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const fetchTransactions = useCallback(async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');

    try {
      const params: Record<string, string | number> = { limit: PAGE_SIZE, offset };
      if (search.trim()) params.search = search.trim();
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/transactions', { params });
      const newData: Transaction[] = res.data;

      setTransactions(prev => (append ? [...prev, ...newData] : newData));
      setHasMore(newData.length === PAGE_SIZE);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load transactions.');
      if (!append) setTransactions([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, typeFilter, statusFilter]);

  // Re-fetch from the start whenever search/filters change
  useEffect(() => {
    fetchTransactions(0, false);
  }, [fetchTransactions]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const t = {
    page: darkMode ? 'bg-[#0b1120]' : 'bg-slate-50',
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

  return (
    <div className={`min-h-screen ${t.page} ${t.textPrimary}`}>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className={`p-2 rounded-xl border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${t.card}`}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">Transactions</h1>
            <p className={`text-xs mt-1.5 ${t.textSecondary}`}>All transactions linked to {user?.name || 'your profile'}</p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className={`border rounded-2xl p-4 space-y-3 ${t.card}`}>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${t.textMuted}`} />
              <input
                type="text"
                placeholder="Search by transaction ID (e.g. TXN-1002)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className={`w-full rounded-xl pl-9 pr-3 py-2 text-xs outline-none ${t.input}`}
              />
            </div>
            <button
              type="submit"
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                darkMode ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`rounded-xl px-3 py-2 text-xs outline-none ${t.input}`}
            >
              <option value="">All Types</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAW">Withdraw</option>
              <option value="TRANSFER">Transfer</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`rounded-xl px-3 py-2 text-xs outline-none ${t.input}`}
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="REJECTED">Rejected</option>
              <option value="FAILED">Failed</option>
            </select>

            {(search || typeFilter || statusFilter) && (
              <button
                onClick={() => { setSearchInput(''); setSearch(''); setTypeFilter(''); setStatusFilter(''); }}
                className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 ${t.cardAlt} ${t.textSecondary}`}
              >
                Clear Filters
              </button>
            )}
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
              onClick={() => fetchTransactions(0, false)}
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
        ) : transactions.length === 0 ? (
          <div className={`text-center py-16 italic text-sm border rounded-2xl ${t.card} ${t.textMuted}`}>
            No transactions found.
          </div>
        ) : (
          <div className="space-y-2.5">
            {transactions.map((txn) => {
              const isCredit = txn.type === 'DEPOSIT';
              const isExpanded = expandedId === txn.id;
              return (
                <div key={txn.id} className={`border rounded-2xl overflow-hidden ${t.card}`}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : txn.id)}
                    className="w-full flex items-center justify-between p-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${
                        isCredit
                          ? (darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-green-100 text-green-700')
                          : (darkMode ? 'bg-rose-500/10 text-rose-400' : 'bg-red-50 text-red-500')
                      }`}>
                        {isCredit ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                      </div>
                      <div className="text-left">
                        <span className={`text-[11px] font-bold block ${t.textPrimary}`}>{typeLabel(txn.type)}</span>
                        <span className={`text-[9px] block font-mono mt-0.5 ${t.textMuted}`}>
                          {new Date(txn.created_at).toLocaleString()} | TXN-{txn.id}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold uppercase border ${statusStyles(txn.status, darkMode)}`}>
                        {txn.status.replace('_', ' ')}
                      </span>
                      <span className={`text-[11px] font-bold tabular-nums ${isCredit ? (darkMode ? 'text-emerald-400' : 'text-green-600') : (darkMode ? 'text-rose-400' : 'text-red-500')}`}>
                        {isCredit ? '+' : '-'} ₹{txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      {isExpanded ? <ChevronUp className={`h-3.5 w-3.5 ${t.textMuted}`} /> : <ChevronDown className={`h-3.5 w-3.5 ${t.textMuted}`} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className={`px-4 pb-4 pt-1 border-t space-y-1.5 text-[10px] ${t.divider} ${t.textSecondary}`}>
                      <div className="flex justify-between"><span className={t.textMuted}>Account</span><span>•••• {txn.account_number.slice(-4)}</span></div>
                      <div className="flex justify-between"><span className={t.textMuted}>Risk Score</span>
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {txn.risk_score}
                        </span>
                      </div>
                      {txn.risk_reason && (
                        <div className="flex justify-between gap-4"><span className={t.textMuted}>Details</span><span className="text-right">{txn.risk_reason}</span></div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => fetchTransactions(transactions.length, true)}
                  disabled={loadingMore}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${t.cardAlt} ${t.textSecondary} ${loadingMore ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Load More
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Transactions;