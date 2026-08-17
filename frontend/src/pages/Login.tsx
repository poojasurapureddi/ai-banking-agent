import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Landmark, ArrowRight, AlertCircle, ShieldAlert } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (emailVal: string, passVal: string) => {
    setEmail(emailVal);
    setPassword(passVal);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 text-slate-900">
      
      {/* Brand Logo header */}
      <div className="flex items-center space-x-3 mb-8">
        <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl shadow-blue-500/20">
          <Landmark className="h-8 w-8" />
        </div>
        <div className="text-left">
          <span className="font-extrabold text-2xl text-slate-900 tracking-wide">SECURE</span>
          <span className="font-light text-2xl text-blue-600">TRUST</span>
          <span className="text-xs block text-slate-400 tracking-widest font-mono uppercase mt-0">AI BANKING AGENT</span>
        </div>
      </div>

      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

        <h2 className="text-center text-2xl font-bold text-slate-900 tracking-tight mb-2">Welcome Back</h2>
        <p className="text-center text-sm text-slate-500 mb-6">Sign in to manage your secure accounts.</p>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start space-x-2 text-red-650 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-550 uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all duration-200 outline-none"
              placeholder="customer@bank.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-550 uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all duration-200 outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/30 cursor-pointer"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-600 hover:text-blue-550 font-semibold transition-all">
            Register here
          </Link>
        </p>

        {/* Quick Credentials Panel for testing */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3">
            <ShieldAlert className="h-4 w-4 text-blue-600" />
            <span>Capstone Testing Quick Login</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleQuickFill('customer@bank.com', 'customer123')}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] py-2 px-1 rounded-lg transition-all leading-tight cursor-pointer font-bold"
            >
              Customer
              <span className="block text-[8px] text-slate-400 font-medium">Alice Johnson</span>
            </button>
            <button
              onClick={() => handleQuickFill('reviewer@bank.com', 'reviewer123')}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-750 text-[10px] py-2 px-1 rounded-lg transition-all leading-tight cursor-pointer font-bold"
            >
              Reviewer
              <span className="block text-[8px] text-slate-400 font-medium">Approvals</span>
            </button>
            <button
              onClick={() => handleQuickFill('admin@bank.com', 'admin123')}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-750 text-[10px] py-2 px-1 rounded-lg transition-all leading-tight cursor-pointer font-bold"
            >
              Admin
              <span className="block text-[8px] text-slate-400 font-medium">Audit logs</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
