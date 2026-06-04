import React from 'react';
import useSyncState from './hooks/useSyncState.js';
import GlowBackground from './components/GlowBackground.jsx';
import LandingPage from './components/LandingPage.jsx';
import OnboardingWizard from './components/OnboardingWizard.jsx';
import DashboardGrid from './components/DashboardGrid.jsx';

function App() {
  const {
    user,
    loading,
    hasProfile,
    logout,
    refreshProfileCheck
  } = useSyncState();

  // 1. Loading screen
  if (loading) {
    return (
      <>
        <GlowBackground />
        <div className="portal-container flex-center">
          <div className="glass-panel" style={{ textAlign: 'center', width: '100%', maxWidth: '450px', padding: '40px' }}>
            <h2 className="font-serif heading-section" style={{ marginBottom: '12px' }}>
              Securing Database Connection
            </h2>
            <p className="text-muted text-sm">
              Authenticating user clinical record credentials...
            </p>
            <div style={{ marginTop: '24px', display: 'inline-block', width: '32px', height: '32px', border: '3px solid var(--primary-glow)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
          
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </>
    );
  }

  // 2. Authentication View (Landing Portal)
  const isAuthenticated = !!user;
  if (!isAuthenticated) {
    return (
      <>
        <GlowBackground />
        <LandingPage 
          onAuthSuccess={refreshProfileCheck} 
        />
      </>
    );
  }

  // 3. New User Onboarding Setup
  if (!hasProfile) {
    return (
      <>
        <GlowBackground />
        <OnboardingWizard 
          onComplete={refreshProfileCheck} 
        />
      </>
    );
  }

  // 4. Return User Primary Dashboard
  return (
    <>
      <GlowBackground />
      <DashboardGrid 
        onLogout={logout} 
      />
    </>
  );
}

export default App;
