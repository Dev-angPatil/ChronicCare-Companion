import React, { useState } from 'react';
import { seedDemoScenario } from '../utils/db.js';

export default function DemoControlDrawer({ onReload }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [activeScenario, setActiveScenario] = useState('');

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
        </div>
      )}
    </div>
  );
}
