import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/AuthGate.css';

export const AuthGate: React.FC = () => {
  const { login, adminLogin, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'admin-login' | 'register'>('login');
  const adminEmail = 'admin@gmail.com';
  const adminPassword = 'adminadmin';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const normalizedEmail = email.trim();
      if (mode === 'login') {
        await login(normalizedEmail, password);
      } else if (mode === 'admin-login') {
        if (normalizedEmail !== adminEmail || password !== adminPassword) {
          setError('Invalid admin credentials.');
          return;
        }
        await adminLogin(normalizedEmail, password);
      } else {
        await register(name, normalizedEmail, password);
      }
      navigate(mode === 'admin-login' ? '/admin' : '/', { replace: true });
    } catch (submitError: unknown) {
      const fallback =
        mode === 'register' ? 'Registration failed' : mode === 'login' ? 'Invalid user. Please register below.' : 'Login failed';
      setError(fallback);
      if (submitError && typeof submitError === 'object' && 'response' in submitError) {
        const err = submitError as {
          response?: { data?: { detail?: string } };
        };
        setError(err.response?.data?.detail ?? fallback);
      } else if (submitError && typeof submitError === 'object' && 'message' in submitError) {
        const err = submitError as { message?: string };
        setError(err.message ?? 'Unable to reach backend. Check if API server is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <h1>SheKurti</h1>
        <p>
          {mode === 'register'
            ? 'Create your account'
            : mode === 'admin-login'
              ? 'Admin login'
              : 'Login to continue'}
        </p>
        <div className="auth-mode-switch">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            User Login
          </button>
          <button type="button" className={mode === 'admin-login' ? 'active' : ''} onClick={() => setMode('admin-login')}>
            Admin Login
          </button>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
          {error ? <div className="auth-error">{error}</div> : null}
          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'register' ? 'Register' : 'Login'}
          </button>
        </form>
        {mode === 'login' && error ? (
          <button type="button" className="auth-switch" onClick={() => setMode('register')}>
            Register below
          </button>
        ) : null}
        <button
          type="button"
          className="auth-switch"
          onClick={() => setMode((prev) => (prev === 'register' ? 'login' : 'register'))}
        >
          {mode === 'register' ? 'Already registered? User Login' : 'Need an account? Register'}
        </button>
      </div>
    </div>
  );
};
