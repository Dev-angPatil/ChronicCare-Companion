import React, { useState, useEffect } from 'react';
import { getPhysicianPatients, linkPatient, getPatientLogs, logUserActivity } from '../utils/db.js';

export default function PhysicianDashboard({ onLogout }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedIsPending, setSelectedIsPending] = useState(false);
  const [patientData, setPatientData] = useState(null); // { logs, profile }
  const [linkEmail, setLinkEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [graphMode, setGraphMode] = useState('glucose'); // 'glucose' or 'bp'

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const list = await getPhysicianPatients();
      setPatients(list);
    } catch (err) {
      console.error('Failed to load physician patients:', err);
    }
  };

  const handleLinkPatient = async (e) => {
    e.preventDefault();
    if (!linkEmail.trim()) return;
    setError('');
    setMessage('');

    try {
      await linkPatient(linkEmail.trim());
      setMessage(`Successfully sent connection request to: ${linkEmail}`);
      setLinkEmail('');
      await loadPatients();
    } catch (err) {
      setError(err.message || 'Failed to link patient.');
    }
  };

  const handleSelectPatient = async (patientId, isPending = false) => {
    setSelectedPatientId(patientId);
    setSelectedIsPending(isPending);
    if (isPending) {
      const pendingProfile = patients.find(p => p.id === patientId);
      setPatientData({ logs: [], profile: pendingProfile });
      return;
    }
    try {
      const data = await getPatientLogs(patientId);
      setPatientData(data);
      await logUserActivity('view_patient_logs', `Physician viewed records for patient ID: ${patientId}`);
    } catch (err) {
      console.error('Failed to retrieve patient logs:', err);
    }
  };

  // SVG Chart Calculator
  const getChartPoints = () => {
    if (!patientData || !patientData.logs || patientData.logs.length === 0) return [];
    const chartLogs = [...patientData.logs].slice(-7);
    
    return chartLogs.map((log, idx) => {
      const x = 50 + (idx * 65);
      let y = 150;
      let rawVal = 0;

      if (graphMode === 'glucose') {
        rawVal = log.glucose || 0;
        y = 180 - ((rawVal - 40) / 180) * 160;
      } else {
        rawVal = log.bp ? parseInt(log.bp.split('/')[0]) : 0;
        y = 180 - ((rawVal - 80) / 100) * 160;
      }
      return { x, y, rawVal, date: log.date };
    });
  };

  const points = getChartPoints();
  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div>
      <header className="dashboard-header">
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Physician Clinic Console</h2>
          <span className="text-muted text-sm">Secure Doctor Portal</span>
        </div>
        <button className="btn-danger" onClick={onLogout}>
          Sign Out
        </button>
      </header>

      <main className="dashboard-main" style={{ gridTemplateColumns: '1fr 2fr' }}>
        
        {/* Left column: patients list & link requests */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div className="glass-panel">
            <h3 className="heading-card" style={{ marginBottom: '16px' }}>Link Patient Account</h3>
            <form onSubmit={handleLinkPatient} className="portal-form">
              <div>
                <label className="input-label" htmlFor="link-email">Patient Email</label>
                <input 
                  id="link-email"
                  type="email" 
                  className="input-field" 
                  placeholder="patient@example.com"
                  value={linkEmail}
                  onChange={e => setLinkEmail(e.target.value)}
                  required 
                />
              </div>
              {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>{error}</div>}
              {message && <div style={{ color: 'var(--color-success)', fontSize: '0.85rem' }}>{message}</div>}
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Link Patient
              </button>
            </form>
          </div>

          <div className="glass-panel">
            <h3 className="heading-card" style={{ marginBottom: '12px' }}>Clinic Patients (Active)</h3>
            <div className="meds-grid" style={{ marginBottom: '24px' }}>
              {patients.filter(p => p.status === 'active' || !p.status).length === 0 ? (
                <p className="text-muted text-sm" style={{ padding: '12px 0', textAlign: 'center' }}>
                  No active clinic patients.
                </p>
              ) : (
                patients.filter(p => p.status === 'active' || !p.status).map(p => (
                  <div 
                    className={`med-item ${selectedPatientId === p.id ? 'taken' : ''}`} 
                    key={p.id} 
                    onClick={() => handleSelectPatient(p.id, false)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="med-item-info">
                      <strong style={{ color: 'var(--text-primary)' }}>{p.name}</strong>
                      <span className="text-muted text-sm">{p.email}</span>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {p.conditions && p.conditions.split(',').map((cond, i) => (
                          <span key={i} className="badge badge-secondary" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                            {cond.trim()}
                          </span>
                        ))}
                        <span className="badge" style={{ fontSize: '0.7rem', padding: '2px 8px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
                          {p.bp_stage || 'Normal'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <h3 className="heading-card" style={{ marginBottom: '12px' }}>Pending Patient Consent</h3>
            <div className="meds-grid">
              {patients.filter(p => p.status === 'pending').length === 0 ? (
                <p className="text-muted text-sm" style={{ padding: '12px 0', textAlign: 'center' }}>
                  No pending consent requests.
                </p>
              ) : (
                patients.filter(p => p.status === 'pending').map(p => (
                  <div 
                    className={`med-item ${selectedPatientId === p.id ? 'taken' : ''}`} 
                    key={p.id} 
                    onClick={() => handleSelectPatient(p.id, true)}
                    style={{ cursor: 'pointer', opacity: 0.7 }}
                  >
                    <div className="med-item-info">
                      <strong style={{ color: 'var(--text-primary)' }}>{p.name || 'New Patient'}</strong>
                      <span className="text-muted text-sm">{p.email}</span>
                      <span className="badge badge-warning" style={{ width: 'fit-content', marginTop: '4px', background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
                        Pending Approval
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column: detailed patient metrics charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {!selectedPatientId ? (
            <div className="glass-panel flex-center" style={{ height: '400px', color: 'var(--text-muted)' }}>
              Select a patient from the roster to display biometric charts.
            </div>
          ) : selectedIsPending ? (
            <div className="glass-panel flex-center" style={{ height: '400px', flexDirection: 'column', padding: '32px', textAlign: 'center', gap: '16px' }}>
              <div style={{ fontSize: '3rem' }}>🔒</div>
              <h3 className="font-serif" style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>Patient Consent Pending</h3>
              <p className="text-muted text-sm" style={{ maxWidth: '400px', lineHeight: '1.6' }}>
                All biometrics history, logs, and clinical profiles are locked. Access will be unlocked automatically once the patient approves your connection request.
              </p>
            </div>
          ) : !patientData ? (
            <div className="glass-panel flex-center" style={{ height: '400px' }}>
              Loading patient data...
            </div>
          ) : (
            <>
              {/* Profile details */}
              <div className="glass-panel">
                <h3 className="heading-card" style={{ marginBottom: '12px' }}>Patient Profile Details</h3>
                <div className="grid-2">
                  <div>
                    <span className="text-muted text-sm">Full Name:</span>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{patientData.profile?.name}</strong>
                  </div>
                  <div>
                    <span className="text-muted text-sm">Chronic Conditions:</span>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{patientData.profile?.conditions}</strong>
                  </div>
                </div>

                <div className="grid-2" style={{ marginTop: '16px' }}>
                  <div>
                    <span className="text-muted text-sm">Glucose Targets:</span>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>
                      {patientData.profile?.glucose_min} - {patientData.profile?.glucose_max} mg/dL
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted text-sm">Systolic / Diastolic target:</span>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>
                      &lt; {patientData.profile?.bp_sys_max} / {patientData.profile?.bp_dia_max} mmHg
                    </strong>
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="glass-panel">
                <div className="flex-between">
                  <h3 className="heading-card">Biometric Trend Curves</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '0.85rem', borderColor: graphMode === 'glucose' ? 'var(--primary)' : '' }}
                      onClick={() => setGraphMode('glucose')}
                    >
                      Glucose
                    </button>
                    <button 
                      className="btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '0.85rem', borderColor: graphMode === 'bp' ? 'var(--primary)' : '' }}
                      onClick={() => setGraphMode('bp')}
                    >
                      Systolic BP
                    </button>
                  </div>
                </div>

                <div className="chart-svg-container">
                  {patientData.logs.length < 2 ? (
                    <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)' }}>
                      Patient has not logged enough readings to plot charts.
                    </div>
                  ) : (
                    <svg width="100%" height="100%" viewBox="0 0 500 200" style={{ overflow: 'visible' }}>
                      <line x1="50" y1="20" x2="450" y2="20" stroke="var(--border-light)" strokeDasharray="3" />
                      <line x1="50" y1="100" x2="450" y2="100" stroke="var(--border-light)" strokeDasharray="3" />
                      <line x1="50" y1="180" x2="450" y2="180" stroke="var(--border-color)" />

                      <polyline fill="none" stroke="var(--primary)" strokeWidth="3" points={polylinePoints} />

                      {points.map((p, idx) => (
                        <g key={`pt-${idx}`}>
                          <circle cx={p.x} cy={p.y} r="5" fill="var(--bg-app)" stroke="var(--primary)" strokeWidth="3" />
                          <text x={p.x} y={p.y - 12} textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontWeight="bold">
                            {p.rawVal}
                          </text>
                          <text x={p.x} y="195" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
                            {p.date}
                          </text>
                        </g>
                      ))}
                    </svg>
                  )}
                </div>
              </div>

              {/* Logs list */}
              <div className="glass-panel">
                <h3 className="heading-card">Log History</h3>
                <div className="timeline-list">
                  {patientData.logs.slice().reverse().map((log, idx) => (
                    <div className="timeline-node active" key={`log-${idx}`}>
                      <div className="timeline-card">
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>{log.date}</strong>
                          <div className="text-muted text-sm">
                            {log.meal === 'skipped' ? '⚠️ Skipped Breakfast' : 'Breakfast Consumed'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '8px' }}>
                          {log.glucose && (
                            <div>
                              <span className="text-muted text-xs">Glucose:</span>
                              <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{log.glucose} mg/dL</div>
                            </div>
                          )}
                          {log.bp && (
                            <div>
                              <span className="text-muted text-xs">BP:</span>
                              <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{log.bp} mmHg</div>
                            </div>
                          )}
                          {log.anxietyLevel !== null && log.anxietyLevel !== undefined && (
                            <div>
                              <span className="text-muted text-xs">Anxiety (GAD-7):</span>
                              <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{log.anxietyLevel}/21</div>
                            </div>
                          )}
                          {log.heartRate !== null && log.heartRate !== undefined && (
                            <div>
                              <span className="text-muted text-xs">Heart Rate:</span>
                              <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{log.heartRate} bpm</div>
                            </div>
                          )}
                          {log.peakFlow !== null && log.peakFlow !== undefined && (
                            <div>
                              <span className="text-muted text-xs">Peak Flow:</span>
                              <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{log.peakFlow} L/min</div>
                            </div>
                          )}
                          {log.inhalerPuffs !== null && log.inhalerPuffs !== undefined && (
                            <div>
                              <span className="text-muted text-xs">Inhaler Puffs:</span>
                              <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{log.inhalerPuffs} puffs</div>
                            </div>
                          )}
                          {log.painLevel !== null && log.painLevel !== undefined && (
                            <div>
                              <span className="text-muted text-xs">Pain Level:</span>
                              <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{log.painLevel}/10</div>
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="text-muted text-sm">Symptoms:</span>
                          <div className="badge badge-secondary" style={{ display: 'block', marginTop: '4px' }}>
                            {log.symptoms}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
