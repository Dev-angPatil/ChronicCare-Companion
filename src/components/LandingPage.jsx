import React, { useState } from 'react';
import { loginWithEmail, registerWithEmail, resetPassword, logUserActivity } from '../utils/db.js';

export default function LandingPage({ onAuthSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isRegister) {
        const userCredential = await registerWithEmail(email, password);
        await logUserActivity('auth_register', `User registered: ${email}`);
        onAuthSuccess();
      } else {
        await loginWithEmail(email, password);
        await logUserActivity('auth_login', `User logged in: ${email}`);
        onAuthSuccess();
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address to reset password.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await resetPassword(email);
      setMessage('Password reset link sent to your email.');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to send reset link.');
    }
  };

  return (
    <div className="portal-container">
      <div className="portal-grid">
        <div className="portal-hero-text">
          <span className="badge badge-primary" style={{ width: 'fit-content' }}>v2.0 Backend Core</span>
          <h1 className="heading-hero">A Path That<br />Shapes Your Future.</h1>
          <p className="portal-tagline">
            Welcome to the ChronicCare Companion. Connect securely to your medical data profile, access real-time linear regression trends, and consult with our intelligent companion to manage diabetes and hypertension.
          </p>
        </div>

        <div className="portal-card">
          <div className="glass-panel">
            <div className="portal-tabs">
              <button 
                type="button"
                className={`portal-tab ${!isRegister ? 'active' : ''}`}
                onClick={() => { setIsRegister(false); setError(''); setMessage(''); }}
              >
                Sign In
              </button>
              <button 
                type="button"
                className={`portal-tab ${isRegister ? 'active' : ''}`}
                onClick={() => { setIsRegister(true); setError(''); setMessage(''); }}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit} className="portal-form">
              <div>
                <label className="input-label" htmlFor="email-input">Email Address</label>
                <input 
                  id="email-input"
                  type="email" 
                  className="input-field" 
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>

              <div>
                <label className="input-label" htmlFor="password-input">Password</label>
                <input 
                  id="password-input"
                  type="password" 
                  className="input-field" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>

              {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{error}</div>}
              {message && <div style={{ color: 'var(--color-success)', fontSize: '0.9rem' }}>{message}</div>}

              <button type="submit" className="btn-primary" style={{ justifyContent: 'center', width: '100%' }} disabled={loading}>
                {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
              </button>

              {!isRegister && (
                <button 
                  type="button" 
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'center', marginTop: '4px' }}
                  onClick={handleForgotPassword}
                >
                  Forgot Password?
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
