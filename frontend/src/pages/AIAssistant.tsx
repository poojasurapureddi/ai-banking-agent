import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import {
  Send,
  Bot,
  User as UserIcon,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  XCircle
} from 'lucide-react';

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

const readStoredDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('darkMode') === 'true';
  } catch {
    return false;
  }
};

export const AIAssistant: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(readStoredDarkMode);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "Hello! I am your SecureTrust AI Banking Assistant. Ask me about your balance, transaction history, or to initiate a transfer.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'darkMode') setDarkMode(readStoredDarkMode());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    if (loading) return;
    const textToSend = overrideText || input;
    if (!textToSend.trim()) return;

    if (!overrideText) setInput('');

    const newUserMessage: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setLoading(true);

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

      setMessages(prev => [...prev, newAgentMessage]);
    } catch (err: any) {
      const errorMsg = "Sorry, I couldn't process that request right now. Please try again.";
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'agent',
        text: errorMsg,
        timestamp: new Date(),
        status: 'error'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTransfer = async () => {
    await handleSend(null as any, "Yes, please proceed and confirm the transfer.");
  };

  const handleCancelTransfer = async () => {
    await handleSend(null as any, "No, cancel this transfer.");
  };

  const t = {
    page: darkMode ? 'bg-[#0b1120]' : 'bg-slate-50',
    panel: darkMode ? 'bg-[#111827] border-slate-800/80' : 'bg-white border-slate-200',
    panelAlt: darkMode ? 'bg-[#0a0e18] border-slate-800/70' : 'bg-slate-50 border-slate-200',
    bubbleAgent: darkMode ? 'bg-[#0a0e18] border border-slate-800 text-slate-200' : 'bg-slate-50 border border-slate-200 text-slate-800',
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
      <div className="max-w-4xl mx-auto px-4 py-8 h-[calc(100vh-4rem)] flex flex-col">

        {/* Assistant Header */}
        <div className={`border p-4 rounded-t-3xl flex items-center justify-between shrink-0 shadow-lg ${t.panel}`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl border ${
              darkMode ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300' : 'bg-blue-50 border-blue-100 text-blue-600'
            }`}>
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-md font-bold">SecureTrust AI Assistant</h1>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className={`text-[10px] font-semibold font-mono tracking-wider uppercase ${t.textSecondary}`}>
                  Guardrails &amp; Risk Engine Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Message Screen */}
        <div className={`flex-1 border-x overflow-y-auto p-6 space-y-6 ${t.panel} border-t-0 border-b-0`}>
          {messages.map((msg) => {
            const isAgent = msg.sender === 'agent';
            return (
              <div key={msg.id} className={`flex items-start gap-3 ${isAgent ? 'justify-start' : 'justify-end'}`}>
                {isAgent && (
                  <div className={`p-2 rounded-xl shrink-0 border ${
                    darkMode ? 'bg-[#0a0e18] border-slate-800 text-cyan-300' : 'bg-slate-50 border-slate-200 text-blue-600'
                  }`}>
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div className="max-w-[75%] space-y-2">
                  <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                    isAgent
                      ? t.bubbleAgent
                      : (darkMode ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20' : 'bg-blue-600 text-white shadow-sm')
                  }`}>
                    <p className="whitespace-pre-line">{msg.text}</p>

                    {isAgent && msg.risk_score != null && msg.status && msg.status !== 'success' && (
                      <div className={`mt-4 pt-3 border-t space-y-3 ${t.divider}`}>
                        <div className="flex justify-between items-center text-[10px] font-mono font-semibold">
                          <span className={t.textSecondary}>Risk Assessment:</span>
                          <span className={`px-2 py-0.5 rounded border ${
                            msg.status === 'review_required'
                              ? (darkMode ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-red-50 text-red-600 border-red-200')
                              : msg.status === 'confirmation_required'
                                ? (darkMode ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-yellow-50 text-yellow-700 border-yellow-200')
                                : (darkMode ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-red-50 text-red-600 border-red-200')
                          }`}>
                            Score: {msg.risk_score} ({msg.risk_level})
                          </span>
                        </div>

                        <div className={`p-3 rounded-xl border flex items-start space-x-2 text-[10px] ${t.panelAlt}`}>
                          {msg.status === 'review_required' ? (
                            <>
                              <ShieldAlert className={`h-4 w-4 shrink-0 ${darkMode ? 'text-rose-400' : 'text-red-500'}`} />
                              <span className={darkMode ? 'text-rose-300' : 'text-red-600'}>
                                This transfer is suspended and routed to the Human Review Queue due to high security risk.
                              </span>
                            </>
                          ) : msg.status === 'confirmation_required' ? (
                            <>
                              <AlertCircle className={`h-4 w-4 shrink-0 ${darkMode ? 'text-amber-400' : 'text-yellow-600'}`} />
                              <span className={darkMode ? 'text-amber-300' : 'text-yellow-700'}>
                                This transaction has medium risk and requires your explicit authorization to execute.
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className={`h-4 w-4 shrink-0 ${darkMode ? 'text-rose-400' : 'text-red-500'}`} />
                              <span className={darkMode ? 'text-rose-300' : 'text-red-600'}>
                                The transaction was rejected/blocked by the business rule engine.
                              </span>
                            </>
                          )}
                        </div>

                        {msg.status === 'confirmation_required' && (
                          <div className="flex gap-2">
                            <button
                              onClick={handleConfirmTransfer}
                              disabled={loading}
                              className={`font-semibold py-2 px-4 rounded-xl text-[10px] transition cursor-pointer flex items-center space-x-1 ${
                                darkMode ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>Confirm and Transfer</span>
                            </button>
                            <button
                              onClick={handleCancelTransfer}
                              disabled={loading}
                              className={`font-semibold py-2 px-4 rounded-xl text-[10px] transition cursor-pointer flex items-center space-x-1 ${
                                darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Cancel</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <span className={`block text-[9px] font-mono ${t.textMuted} ${!isAgent ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {!isAgent && (
                  <div className={`p-2 rounded-xl text-white shrink-0 ${darkMode ? 'bg-cyan-600' : 'bg-blue-600'}`}>
                    <UserIcon className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-3 justify-start">
              <div className={`p-2 rounded-xl shrink-0 border ${
                darkMode ? 'bg-[#0a0e18] border-slate-800 text-cyan-300' : 'bg-slate-50 border-slate-200 text-blue-600'
              }`}>
                <Bot className="h-4 w-4" />
              </div>
              <div className={`p-4 rounded-2xl text-xs flex items-center space-x-2 border ${t.panelAlt} ${t.textSecondary}`}>
                <Loader2 className={`h-4 w-4 animate-spin ${darkMode ? 'text-cyan-500' : 'text-blue-600'}`} />
                <span>Analyzing rules and assessing risk...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form Footer */}
        <form onSubmit={(e) => handleSend(e)} className={`border p-4 rounded-b-3xl shrink-0 flex gap-2 items-center ${t.panel}`}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me 'What is my balance?' or 'Transfer 50 to John'..."
            disabled={loading}
            className={`w-full rounded-xl px-4 py-3 text-xs outline-none transition-all ${t.input}`}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={`p-3 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 text-white ${
              darkMode ? 'bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40' : 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800'
            }`}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistant;