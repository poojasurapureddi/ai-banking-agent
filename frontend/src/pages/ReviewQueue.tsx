import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  ShieldCheck, 
  Check, 
  X, 
  AlertCircle, 
  HelpCircle,
  User as UserIcon
} from 'lucide-react';

interface ReviewRequest {
  id: number;
  transaction_id: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: number;
  created_at: string;
  reviewed_at?: string;
  transaction?: {
    id: number;
    amount: number;
    risk_score: number;
    risk_reason?: string;
    created_at: string;
    account: {
      account_number: string;
      user: {
        name: string;
        email: string;
      }
    };
    beneficiary?: {
      name: string;
      account_number: string;
      is_verified: boolean;
    }
  }
}

export const ReviewQueue: React.FC = () => {
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'PENDING' | 'RESOLVED'>('PENDING');

  const fetchReviews = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/reviews');
      // For rich displaying, we can load additional reviews
      setReviews(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to retrieve review request queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/reviews/${id}/${action}`);
      setSuccessMsg(res.data.message);
      fetchReviews();
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to ${action} review request.`);
    }
  };

  const filteredReviews = reviews.filter(r => {
    if (activeTab === 'PENDING') {
      return r.status === 'PENDING';
    } else {
      return r.status === 'APPROVED' || r.status === 'REJECTED';
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-white space-y-8">
      {/* Header banner */}
      <div className="bg-panel/40 border border-gray-800 p-6 rounded-3xl backdrop-blur flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="bg-yellow-600/10 border border-yellow-500/30 p-3 rounded-2xl text-yellow-500">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Compliance Review Queue</h1>
            <p className="text-gray-400 text-sm mt-1">Review flagged high-risk transactions and approve or reject their execution.</p>
          </div>
        </div>
        <div className="text-sm font-semibold px-4 py-2 bg-yellow-950/20 text-yellow-400 border border-yellow-900/30 rounded-xl font-mono">
          Pending Audits: {reviews.filter(r => r.status === 'PENDING').length}
        </div>
      </div>

      {successMsg && (
        <div className="bg-green-950/20 border border-green-500/30 text-green-400 px-4 py-3 rounded-2xl text-xs flex items-center space-x-2">
          <Check className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-950/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-2xl text-xs flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-800 pb-px">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`pb-4 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'PENDING' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          Pending Review
        </button>
        <button
          onClick={() => setActiveTab('RESOLVED')}
          className={`pb-4 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'RESOLVED' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          Resolved Audits
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="text-center py-16 bg-panel/20 border border-gray-850 rounded-3xl">
          <HelpCircle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="font-bold text-lg text-gray-400">Queue is empty</h3>
          <p className="text-gray-500 text-xs mt-1">No transaction items found matching this filter.</p>
        </div>
      ) : (
        <div className="bg-panel/20 border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/40 text-gray-400 font-semibold uppercase tracking-wider">
                  <th className="p-4">Transaction ID</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Recipient</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-center">Risk Score</th>
                  <th className="p-4">Flag Reason</th>
                  <th className="p-4">Created Time</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {filteredReviews.map(review => {
                  const txn = review.transaction;
                  
                  // Helper mock information in case transaction is nested/resolved differently
                  const customerName = txn?.account?.user?.name || "System Seed Account";
                  const customerEmail = txn?.account?.user?.email || "seed@bank.com";
                  const beneficiaryName = txn?.beneficiary?.name || "Unknown/External Account";
                  const beneficiaryAcc = txn?.beneficiary?.account_number || "N/A";
                  const score = txn?.risk_score || 0;
                  const amount = txn?.amount || 0;

                  return (
                    <tr key={review.id} className="hover:bg-gray-900/10 transition-colors">
                      {/* ID */}
                      <td className="p-4 font-mono font-bold text-blue-400">
                        TXN-{txn?.id || review.transaction_id}
                      </td>

                      {/* Customer */}
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <div className="bg-gray-800 p-1 rounded text-gray-400">
                            <UserIcon className="h-3 w-3" />
                          </div>
                          <div>
                            <span className="font-semibold block text-gray-200">{customerName}</span>
                            <span className="text-[10px] text-gray-500 block">{customerEmail}</span>
                          </div>
                        </div>
                      </td>

                      {/* Recipient */}
                      <td className="p-4 leading-tight">
                        <span className="font-semibold block text-gray-200">{beneficiaryName}</span>
                        <span className="text-[10px] text-gray-500 font-mono block">Acc: {beneficiaryAcc}</span>
                      </td>

                      {/* Amount */}
                      <td className="p-4 text-right font-bold text-sm text-white">
                        ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Risk Score */}
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded font-mono font-bold text-[10px] ${
                          score >= 61 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        }`}>
                          {score} / 100
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="p-4 max-w-[200px]">
                        <span className="text-gray-400 text-[11px] block truncate" title={review.reason || txn?.risk_reason}>
                          {review.reason || txn?.risk_reason}
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="p-4 text-gray-500 font-mono text-[10px]">
                        {new Date(review.created_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        {review.status === 'PENDING' ? (
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleAction(review.id, 'approve')}
                              className="bg-green-600 hover:bg-green-500 text-white p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Approve Transaction"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleAction(review.id, 'reject')}
                              className="bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Reject Transaction"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-extrabold uppercase ${
                            review.status === 'APPROVED' 
                              ? 'bg-green-950/30 text-green-400' 
                              : 'bg-red-950/30 text-red-400'
                          }`}>
                            {review.status}
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
