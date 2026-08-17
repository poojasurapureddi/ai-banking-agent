import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Landmark, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CUSTOMER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !role) return;

    setError('');
    setLoading(true);
    try {
      await register(name, email, password, role);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to register account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 text-slate-900">
      
      {/* Brand logo */}
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

        <h2 className="text-center text-2xl font-bold text-slate-900 tracking-tight mb-2">Create Account</h2>
        <p className="text-center text-sm text-slate-500 mb-6">Register a new profile to access services.</p>

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-3 flex items-start space-x-2 text-green-750 text-xs">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Account created successfully! Redirecting you to login...</span>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start space-x-2 text-red-600 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-550 uppercase tracking-wider mb-2">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all duration-200 outline-none"
              placeholder="Alice Johnson"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-550 uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all duration-200 outline-none"
              placeholder="alice@gmail.com"
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

          <div>
            <label className="block text-xs font-semibold text-slate-550 uppercase tracking-wider mb-2">System Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-sm text-slate-900 transition-all duration-200 outline-none"
            >
              <option value="CUSTOMER">CUSTOMER (Standard User)</option>
              <option value="REVIEWER">REVIEWER (Risk Compliance)</option>
              <option value="ADMIN">ADMIN (Full Operations)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/30 cursor-pointer mt-6"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <span>Register</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-550 font-semibold transition-all">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
};
