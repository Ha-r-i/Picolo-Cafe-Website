import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './AdminLogin.css';

/**
 * Admin Login Component
 * Handles admin authentication
 */
const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        setError(result.error || 'Failed to login. Please check your credentials.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-container">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <h1>Piccolo Cafe</h1>
            <h2>Admin Dashboard</h2>
            <p>Sign in to manage your cafe</p>
          </div>

          {error && (
            <div className="admin-login-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="admin-login-form">
            <div className="admin-form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@piccolocafe.com"
                disabled={loading}
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="admin-login-btn"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="admin-login-footer">
            <p>© 2024 Piccolo Cafe. Admin Access Only.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
