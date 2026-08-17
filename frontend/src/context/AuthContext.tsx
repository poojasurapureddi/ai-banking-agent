import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface User {
  name: string;
  role: 'CUSTOMER' | 'ADMIN' | 'REVIEWER';
  token: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role') as User['role'] | null;
    const name = localStorage.getItem('name');

    if (token && role && name) {
      setUser({ token, role, name });
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { access_token, role, name } = response.data;
    
    localStorage.setItem('token', access_token);
    localStorage.setItem('role', role);
    localStorage.setItem('name', name);
    
    setUser({ token: access_token, role, name });
  };

  const register = async (name: string, email: string, password: string, role: string) => {
    await api.post('/auth/register', { name, email, password, role });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('name');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
