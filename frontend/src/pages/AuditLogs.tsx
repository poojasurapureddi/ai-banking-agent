import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  ClipboardList, 
  Search, 
  HelpCircle, 
  RefreshCw 
} from 'lucide-react';

interface AuditLog {
  id: number;
  user_id?: number;
  action: string;
  entity_type: string;
  entity_id?: number;
  details?: string;
  created_at: string;
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/audit-logs');
      setLogs(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const term = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      log.entity_type.toLowerCase().includes(term) ||
      (log.details && log.details.toLowerCase().includes(term))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-white space-y-8">
      {/* Header banner */}
      <div className="bg-panel/40 border border-gray-800 p-6 rounded-3xl backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="bg-blue-600/10 border border-blue-500/30 p-3 rounded-2xl text-blue-400">
            <ClipboardList className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">System Audit Ledger</h1>
            <p className="text-gray-400 text-sm mt-1">Immutable log of critical system operations and user sessions.</p>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="bg-gray-900 border border-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 w-64"
            />
          </div>
          
          <button 
            onClick={fetchLogs}
            className="bg-gray-900 border border-gray-805 hover:bg-gray-800 text-gray-400 hover:text-white p-2 rounded-xl transition cursor-pointer"
            title="Reload Logs"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-2xl text-xs">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-16 bg-panel/20 border border-gray-850 rounded-3xl">
          <HelpCircle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="font-bold text-lg text-gray-400">No logs found</h3>
          <p className="text-gray-500 text-xs mt-1">No log entries matched your filter query.</p>
        </div>
      ) : (
        <div className="bg-panel/20 border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/40 text-gray-400 font-semibold uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">Log ID</th>
                  <th className="p-4">Action</th>
                  <th className="p-4 text-center">User ID</th>
                  <th className="p-4">Target Entity</th>
                  <th className="p-4">Entity ID</th>
                  <th className="p-4">JSON details</th>
                  <th className="p-4">Recorded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80 font-mono">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-900/10 transition-colors">
                    
                    {/* Log ID */}
                    <td className="p-4 text-center text-gray-500 text-[10px]">
                      #{log.id}
                    </td>

                    {/* Action */}
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        log.action.includes('REGISTER') || log.action.includes('LOGIN')
                          ? 'bg-blue-950/40 text-blue-400 border border-blue-900/20'
                          : log.action.includes('EXECUTE') || log.action.includes('APPROVE')
                            ? 'bg-green-950/40 text-green-400 border border-green-900/20'
                            : 'bg-yellow-950/40 text-yellow-400 border border-yellow-900/20'
                      }`}>
                        {log.action}
                      </span>
                    </td>

                    {/* User ID */}
                    <td className="p-4 text-center text-gray-300 font-semibold">
                      {log.user_id ? `USR-${log.user_id}` : "GUEST"}
                    </td>

                    {/* Target Entity */}
                    <td className="p-4 text-gray-200">
                      {log.entity_type}
                    </td>

                    {/* Entity ID */}
                    <td className="p-4 text-gray-300 font-semibold">
                      {log.entity_id ? `${log.entity_type.substring(0,3).toUpperCase()}-${log.entity_id}` : "N/A"}
                    </td>

                    {/* JSON details */}
                    <td className="p-4 max-w-[280px]">
                      <span className="text-gray-400 block truncate text-[10px] font-sans" title={log.details}>
                        {log.details || 'None'}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="p-4 text-gray-500 text-[10px]">
                      {new Date(log.created_at).toLocaleString('en-US')}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
