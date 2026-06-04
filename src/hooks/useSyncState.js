/* ----------------------------------------------------
   JWT USER SESSION HOOK (src/hooks/useSyncState.js)
   ---------------------------------------------------- */

import { useState, useEffect } from 'react';
import { getProfile, logoutUser, logUserActivity } from '../utils/db.js';

export default function useSyncState() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  const checkSession = async () => {
    const token = localStorage.getItem('cc_token');
    if (token) {
      try {
        const payloadBase64 = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payloadBase64));
        const role = decodedPayload.role || 'patient';
        
        const prof = await getProfile();
        setUser({ authenticated: true, role });
        setHasProfile(!!prof);
      } catch (err) {
        console.error('Session verification failed, logging out:', err);
        localStorage.removeItem('cc_token');
        setUser(null);
        setHasProfile(false);
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
      await logUserActivity('auth_logout', 'User logged out of session.');
      await logoutUser();
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUser(null);
    setHasProfile(false);
    setLoading(false);
  };

  const refreshProfileCheck = async () => {
    await checkSession();
  };

  return {
    user,
    isGuest: false, // Disabled guest experience per request
    loading,
    hasProfile,
    loginGuest: null,
    logout,
    refreshProfileCheck
  };
}
