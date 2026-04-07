/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  adminLogin as apiAdminLogin,
  getCurrentUser,
  getStoredAuthToken,
  login as apiLogin,
  register as apiRegister,
  setAuthToken,
  type AuthUser,
} from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  adminLogin: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const safetyTimer = window.setTimeout(() => {
      if (mounted) {
        setIsLoading(false);
      }
    }, 12000);

    const bootstrapAuth = async () => {
      const token = getStoredAuthToken();
      if (!token) {
        if (mounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const me = await getCurrentUser();
        if (mounted) {
          setUser(me.user);
          setSessionId(me.session_id ?? null);
        }
      } catch {
        setAuthToken(null);
        if (mounted) {
          setUser(null);
          setSessionId(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrapAuth();
    return () => {
      mounted = false;
      window.clearTimeout(safetyTimer);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiLogin({ email, password });
    setAuthToken(response.token);
    setUser(response.user);
    setSessionId(response.session_id ?? null);
  };

  const adminLogin = async (email: string, password: string) => {
    const response = await apiAdminLogin({ email, password });
    setAuthToken(response.token);
    setUser(response.user);
    setSessionId(response.session_id ?? null);
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await apiRegister({ name, email, password });
    setAuthToken(response.token);
    setUser(response.user);
    setSessionId(response.session_id ?? null);
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
    setSessionId(null);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      sessionId,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      adminLogin,
      register,
      logout,
    }),
    [user, sessionId, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
