import React, { useState } from 'react';
import { seedDemoScenario } from '../utils/db.js';

export default function DemoControlDrawer({ onReload }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [activeScenario, setActiveScenario] = useState('');
  const [customIp, setCustomIp] = useState(localStorage.getItem('cc_custom_server_ip') || '');

  const saveCustomIp = () => {
    if (customIp.trim()) {
      localStorage.setItem('cc_custom_server_ip', customIp.trim());
    } else {
      localStorage.removeItem('cc_custom_server_ip');
    }
    window.location.reload();
  };

  const triggerDemoNotification = (type) => {
    let detail = {};
    if (type === 'medication') {
      detail = {
        title: '💊 Medication Reminder',
        body: 'Metformin 500mg is due now. Please take it and record compliance.',
        type: 'medication',
        data: { medId: 'metformin' }
      };
    } else {
      detail = {
        title: '🚨 Critical Vitals Warning',
        body: 'Alert: Your recent blood pressure reading exceeds your target limits (142/92 mmHg). Stage 2 Hypertension detected.',
        type: 'critical_vital',
        data: { alertId: 'bp_spike' }
      };
    }
    
    const event = new CustomEvent('cc_trigger_notification', { detail });
    window.dispatchEvent(event);
    setIsOpen(false);
  };

  const handleSeed = async (scenario) => {
    setIsSeeding(true);
    setActiveScenario(scenario);
    try {
      await seedDemoScenario(scenario);
      // Let the parent know we completed seeding so it can reload profile & logs
      if (onReload) {
        await onReload();
      }
      alert(`Demo Scenario successfully injected! Dashboard updated.`);
      setIsOpen(false);
    } catch (err) {
      console.error('Demo seeding failed:', err);
      alert('Error injecting scenario: ' + err.message);
    } finally {
      setIsSeeding(false);
      setActiveScenario('');
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }} className="no-print">
      {/* Floating Sparkle Button */}
      {!isOpen ? (
        <button
          type="button"
          className="btn-primary"
          style={{
            borderRadius: '9999px',
            width: '56px',
            height: '56px',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(230, 0, 35, 0.3)',
            fontSize: '1.4rem',
            border: 'none',
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onClick={() => setIsOpen(true)}
          title="Open Live Demo Control Center"
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          ✨
        </button>
      ) : (
        /* Seeding Panel Card */
        <div
          className="glass-panel"
          style={{
            backgroundColor: 'var(--canvas)',
            width: '320px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
            border: '1px solid var(--hairline)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            animation: 'modal-slide-up 0.25s ease'
          }}
        >
          <div className="flex-between" style={{ borderBottom: '1px solid var(--hairline-soft)', paddingBottom: '8px' }}>
            <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--ink)' }}>✨ Live Demo Control Center</span>
            <button
              type="button"
              style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--mute)' }}
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>
          
          <p className="text-muted text-xs" style={{ margin: 0, lineHeight: '1.4' }}>
            Quick-inject mock vitals history scenarios directly into SQLite to demonstrate the correlation engine and linear trends.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                fontSize: '0.8rem',
                padding: '10px 12px',
                height: 'auto',
                opacity: isSeeding ? 0.6 : 1
              }}
              disabled={isSeeding}
              onClick={() => handleSeed('stable')}
            >
              🟢 {isSeeding && activeScenario === 'stable' ? 'Injecting...' : 'Stable Diabetes Compliance'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                fontSize: '0.8rem',
                padding: '10px 12px',
                height: 'auto',
                opacity: isSeeding ? 0.6 : 1
              }}
              disabled={isSeeding}
              onClick={() => handleSeed('hypertension_risk')}
            >
              🔴 {isSeeding && activeScenario === 'hypertension_risk' ? 'Injecting...' : 'Hypertension Slope Crisis'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                fontSize: '0.8rem',
                padding: '10px 12px',
                height: 'auto',
                opacity: isSeeding ? 0.6 : 1
              }}
              disabled={isSeeding}
              onClick={() => handleSeed('anxiety_vagal')}
            >
              🟣 {isSeeding && activeScenario === 'anxiety_vagal' ? 'Injecting...' : 'Anxiety Vagal HR Coupling'}
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--hairline-soft)', paddingTop: '10px', marginTop: '4px' }}>
            <span style={{ fontWeight: '600', fontSize: '0.8rem', color: 'var(--ink)', display: 'block', marginBottom: '6px' }}>
              🌐 Server Connection Config
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="e.g. 192.168.1.100:5000"
                value={customIp}
                onChange={(e) => setCustomIp(e.target.value)}
                style={{
                  flex: 1,
                  fontSize: '0.75rem',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--hairline)',
                  backgroundColor: 'var(--card, #ffffff)',
                  color: 'var(--ink)'
                }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={saveCustomIp}
                style={{
                  fontSize: '0.75rem',
                  padding: '6px 10px',
                  height: 'auto',
                  lineHeight: '1',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--ink)',
                  color: 'var(--canvas)'
                }}
              >
                Save
              </button>
            </div>
            <span style={{ fontSize: '0.65rem', color: 'var(--mute)', display: 'block', marginTop: '4px' }}>
              Default: Local Host or Emulator (10.0.2.2)
            </span>
          </div>

          <div style={{ borderTop: '1px solid var(--hairline-soft)', paddingTop: '10px', marginTop: '4px' }}>
            <span style={{ fontWeight: '600', fontSize: '0.8rem', color: 'var(--ink)', display: 'block', marginBottom: '6px' }}>
              🔔 Simulate Push Alerts
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, fontSize: '0.72rem', padding: '6px 8px', height: 'auto', borderRadius: 'var(--radius-sm)' }}
                onClick={() => triggerDemoNotification('medication')}
              >
                💊 Pill Reminder
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, fontSize: '0.72rem', padding: '6px 8px', height: 'auto', borderRadius: 'var(--radius-sm)' }}
                onClick={() => triggerDemoNotification('vital')}
              >
                🚨 Vitals Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
