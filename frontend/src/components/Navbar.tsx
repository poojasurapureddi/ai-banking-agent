import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Landmark, 
  MessageSquare, 
  ShieldCheck, 
  ClipboardList, 
  LogOut, 
  User as UserIcon,
  Activity
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const linkClass = (path: string) => `
    flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
    ${isActive(path) 
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
      : 'text-gray-400 hover:text-white hover:bg-gray-800'}
  `;

  return (
    <nav className="bg-sidebar border-b border-gray-800 sticky top-0 z-50 px-4 sm:px-6 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo Section */}
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md shadow-blue-500/20">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <span className="font-extrabold text-lg text-white tracking-wide">SECURE</span>
            <span className="font-light text-lg text-blue-500">TRUST</span>
            <span className="text-[10px] block text-gray-500 tracking-widest font-mono uppercase -mt-1">AI BANKING</span>
          </div>
        </div>

        {/* Links Navigation */}
        <div className="hidden md:flex items-center space-x-2">
          <Link to="/dashboard" className={linkClass('/dashboard')}>
            <Activity className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
          
          <Link to="/assistant" className={linkClass('/assistant')}>
            <MessageSquare className="h-4 w-4" />
            <span>AI Assistant</span>
          </Link>

          {(user.role === 'REVIEWER' || user.role === 'ADMIN') && (
            <Link to="/reviews" className={linkClass('/reviews')}>
              <ShieldCheck className="h-4 w-4" />
              <span>Review Queue</span>
            </Link>
          )}

          {user.role === 'ADMIN' && (
            <Link to="/admin/audit-logs" className={linkClass('/admin/audit-logs')}>
              <ClipboardList className="h-4 w-4" />
              <span>Audit Logs</span>
            </Link>
          )}
        </div>

        {/* User profile & Logout */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-panel px-3 py-1.5 rounded-lg border border-gray-800">
            <div className="bg-gray-800 text-blue-400 p-1 rounded-md">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="text-left leading-none">
              <span className="text-xs font-semibold text-gray-200 block">{user.name}</span>
              <span className={`text-[10px] font-mono tracking-wider uppercase ${
                user.role === 'ADMIN' 
                  ? 'text-red-400' 
                  : user.role === 'REVIEWER' 
                    ? 'text-yellow-400' 
                    : 'text-green-400'
              }`}>
                {user.role}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 px-3 py-1.5 border border-red-900/30 hover:border-red-600 bg-red-950/20 text-red-400 hover:text-white hover:bg-red-600 rounded-lg text-sm transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile Links Navigation bar */}
      <div className="md:hidden flex items-center justify-around mt-3 pt-2 border-t border-gray-800">
        <Link to="/dashboard" className={linkClass('/dashboard')}>
          <Activity className="h-4 w-4" />
        </Link>
        <Link to="/assistant" className={linkClass('/assistant')}>
          <MessageSquare className="h-4 w-4" />
        </Link>
        {(user.role === 'REVIEWER' || user.role === 'ADMIN') && (
          <Link to="/reviews" className={linkClass('/reviews')}>
            <ShieldCheck className="h-4 w-4" />
          </Link>
        )}
        {user.role === 'ADMIN' && (
          <Link to="/admin/audit-logs" className={linkClass('/admin/audit-logs')}>
            <ClipboardList className="h-4 w-4" />
          </Link>
        )}
      </div>
    </nav>
  );
};
