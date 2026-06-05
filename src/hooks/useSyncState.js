/* ----------------------------------------------------
   JWT USER SESSION HOOK (src/hooks/useSyncState.js)
   ---------------------------------------------------- */

import { useState, useEffect } from 'react';
import { getProfile, logoutUser, logUserActivity, loginWithEmail, registerWithEmail } from '../utils/db.js';

export default function useSyncState() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  const autoAuthenticate = async () => {
    const defaultEmail = 'patient@chroniccare.app';
    const defaultPassword = 'password123';
    
    try {
      // 1. Attempt login with default credentials
      const res = await loginWithEmail(defaultEmail, defaultPassword);
      console.log('Auto-authenticated online successfully:', res);
      return res.user;
    } catch (loginErr) {
      // 2. If login failed (e.g. account doesn't exist yet), try registering
      try {
        const res = await registerWithEmail(defaultEmail, defaultPassword, 'patient');
        console.log('Auto-registered online successfully:', res);
        return res.user;
      } catch (regErr) {
        console.warn('Auto-auth server connection failed (offline mode). Creating mock local session.');
        
        // 3. If offline, create a mock JWT token locally
        if (!localStorage.getItem('cc_token')) {
          const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
          const payload = btoa(JSON.stringify({ userId: 1, role: 'patient', exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) }));
          const signature = 'mock_signature';
          const dummyToken = `${header}.${payload}.${signature}`;
          localStorage.setItem('cc_token', dummyToken);
        }
        return { authenticated: true, role: 'patient' };
      }
    }
  };

  const checkSession = async () => {
    let token = localStorage.getItem('cc_token');
    
    // Auto-authenticate if token is missing (ensures direct onboarding entry for native app)
    if (!token) {
      await autoAuthenticate();
      token = localStorage.getItem('cc_token');
    }

    if (token) {
      try {
        const payloadBase64 = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payloadBase64));
        const role = decodedPayload.role || 'patient';
        
        const prof = await getProfile();
        setUser({ authenticated: true, role });
        setHasProfile(!!prof);
      } catch (err) {
        console.error('Session verification failed:', err);
        if (err.message === 'AUTH_EXPIRED') {
          console.warn('Authentication token expired or rejected by server. Resetting session.');
          localStorage.removeItem('cc_token');
          setUser(null);
          setHasProfile(false);
        } else {
          console.warn('Network error or timeout. Falling back to local offline mode.');
          setUser({ authenticated: true, role });
          setHasProfile(true);
        }
      }
    } else {
      setUser(null);
      setHasProfile(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkSession();
  }, []);

  const logout = async () => {
    setLoading(true);
    try {
      await logUserActivity('auth_logout', 'User cleared clinical profile and reset app.');
      await logoutUser();
    } catch (err) {
      console.error('Logout/Reset error:', err);
    }
    setUser(null);
    setHasProfile(false);
    window.location.reload();
  };

  const refreshProfileCheck = async () => {
    await checkSession();
  };

  return {
    user,
    isGuest: false,
    loading,
    hasProfile,
    loginGuest: null,
    logout,
    refreshProfileCheck
  };
}
