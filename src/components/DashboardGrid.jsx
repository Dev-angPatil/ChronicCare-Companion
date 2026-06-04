import React, { useState, useEffect } from 'react';
import { getProfile, getLogs, addLog, getMedications, updateMedication, getMessages, addMessage, clearMessages, logUserActivity, getAnalysisData } from '../utils/db.js';
import PromptLab from './PromptLab.jsx';

export default function DashboardGrid({ onLogout }) {
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [meds, setMeds] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isPromptLabOpen, setIsPromptLabOpen] = useState(false);
  
  // Server-side analysis states
  const [wellnessScore, setWellnessScore] = useState(75);
  const [streakDays, setStreakDays] = useState(0);
  const [analysis, setAnalysis] = useState({ alerts: [], correlations: [], insights: [] });

  // Quick Log states
  const [logGlucose, setLogGlucose] = useState('');
  const [logBpSys, setLogBpSys] = useState('');
  const [logBpDia, setLogBpDia] = useState('');
  const [logMeal, setLogMeal] = useState('yes');
  const [logSymptoms, setLogSymptoms] = useState('');

  // Graph Toggle
  const [graphMode, setGraphMode] = useState('glucose'); // 'glucose' or 'bp'

  // Load dashboard data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const profData = await getProfile();
      const logsData = await getLogs();
      const medsData = await getMedications();
      const msgsData = await getMessages();

      setProfile(profData);
      setLogs(logsData);
      setMeds(medsData);
      setChatMessages(msgsData);

      // Load server-computed clinical analytics
      if (profData) {
        const analysisData = await getAnalysisData();
        setWellnessScore(analysisData.wellnessScore);
        setStreakDays(analysisData.streakDays);
        setAnalysis(analysisData.analysis);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  // Latest values
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const latestGlucose = lastLog && lastLog.glucose !== null ? `${lastLog.glucose} mg/dL` : 'No logs';
  const latestBp = lastLog && lastLog.bp ? `${lastLog.bp} mmHg` : 'No logs';

  // 2. Event Handlers
  const handleQuickLog = async (e) => {
    e.preventDefault();
    if (!logGlucose && !logBpSys) {
      alert('Please enter at least a Blood Glucose or Blood Pressure value.');
      return;
    }

    try {
      const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).replace(',', '');
      
      const newEntry = {
        date: todayStr,
        glucose: logGlucose ? Number(logGlucose) : null,
        bp: (logBpSys && logBpDia) ? `${logBpSys}/${logBpDia}` : null,
        meal: logMeal,
        symptoms: logSymptoms || 'None reported'
      };

      await addLog(newEntry);
      await logUserActivity('quick_log', `Logged data: Sugar=${logGlucose || 'N/A'}, BP=${logBpSys ? logBpSys + '/' + logBpDia : 'N/A'}`);
      
      // Clear forms
      setLogGlucose('');
      setLogBpSys('');
      setLogBpDia('');
      setLogSymptoms('');

      // Reload
      await loadAllData();
    } catch (err) {
      console.error('Error logging details:', err);
    }
  };

  const handleToggleMed = async (medId) => {
    const updatedMeds = meds.map(m => {
      if (m.id === medId) {
        const nextTaken = !m.taken;
        const updated = { ...m, taken: nextTaken };
        // Save and reload
        updateMedication(updated).then(() => {
          logUserActivity('toggle_medication', `Prescription ${m.name} set to ${nextTaken ? 'Taken' : 'Remaining'}`);
          loadAllData();
        });
        return updated;
      }
      return m;
    });
    setMeds(updatedMeds);
  };

  // Unified Chatbot Logic
  const processCompanionQuery = async (userText) => {
    if (!userText.trim()) return;

    // Append user message
    const userMsg = {
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const currentMessages = [...chatMessages, userMsg];
    setChatMessages(currentMessages);
    await addMessage(userMsg);

    // Generate educational, clinically-focused reply
    let assistantText = '';
    const textLower = userText.toLowerCase();

    if (textLower.includes('dizzy') || textLower.includes('dizziness') || textLower.includes('lighthead')) {
      assistantText = `I noticed you mentioned feeling dizzy. Examining your profile and logs, `;
      const glucoseLogs = logs.filter(l => l.glucose !== null && l.glucose !== undefined);
      const lowSugarLogs = glucoseLogs.filter(l => l.glucose < 90);
      
      if (lowSugarLogs.length > 0) {
        assistantText += `dizziness is historically linked to lower blood sugars in your logs. Your last recorded blood sugar was ${lastLog?.glucose || 'N/A'} mg/dL. If you are dropping below 70 mg/dL, please consume 15g of fast-acting sugar (fruit juice or glucose tablets) immediately.`;
      } else {
        assistantText += `dizziness can also arise from blood pressure changes. Your latest blood pressure is ${latestBp}. Please sit down, rest, and contact ${profile?.physicianName || 'your physician'} if symptoms persist.`;
      }
    } else if (textLower.includes('headache') || textLower.includes('migraine')) {
      assistantText = `A headache can be a clinical response to blood pressure fluctuations. Your latest BP reads ${latestBp}. `;
      const sys = lastLog?.bp ? parseInt(lastLog.bp.split('/')[0]) : 0;
      if (sys >= 135) {
        assistantText += `Because your systolic blood pressure is elevated, this headache may correlate with Stage 1/2 hypertension. Please rest in a quiet room, avoid high-sodium foods, and re-test in 15 minutes.`;
      } else {
        assistantText += `Please log your blood pressure so we can check if it aligns with this headache. If it exceeds 140 mmHg, consult ${profile?.physicianName || 'Dr. Ramirez'} immediately.`;
      }
    } else if (textLower.includes('risk') || textLower.includes('predict') || textLower.includes('forecast')) {
      if (analysis.alerts.length > 0) {
        assistantText = `Based on my 48-hour forecasting engine, here are active clinical predictions: \n\n` + 
          analysis.alerts.map(a => `- ${a}`).join('\n') + `\n\nEnsure compliance with your ${meds.filter(m => !m.taken).length} remaining prescriptions today.`;
      } else {
        assistantText = `Your glucose and blood pressure indicators are currently tracking stably with a wellness compliance score of ${wellnessScore}/100. No critical 48-hour forecasting risks detected. Keep up the consistent logging!`;
      }
    } else if (textLower.includes('medication') || textLower.includes('metformin') || textLower.includes('amlodipine')) {
      const untaken = meds.filter(m => !m.taken);
      if (untaken.length > 0) {
        assistantText = `You have ${untaken.length} medication(s) remaining for today: ${untaken.map(m => m.name).join(', ')}. Please mark them as taken once consumed. Consistent dosing is vital for stabilizing clinical curves.`;
      } else {
        assistantText = `Excellent! All of today's medications (${meds.map(m => m.name).join(', ')}) have been marked as taken. Compliance is key.`;
      }
    } else if (textLower.includes('appointment') || textLower.includes('ramirez') || textLower.includes('summarize')) {
      const glucoseLogs = logs.filter(l => l.glucose !== null && l.glucose !== undefined);
      const avgGlucose = glucoseLogs.length > 0 ? Math.round(glucoseLogs.reduce((acc, curr) => acc + curr.glucose, 0) / glucoseLogs.length) : 'N/A';
      
      const bpLogs = logs.filter(l => l.bp);
      const avgSys = bpLogs.length > 0 ? Math.round(bpLogs.reduce((acc, curr) => acc + parseInt(curr.bp.split('/')[0]), 0) / bpLogs.length) : 'N/A';
      const avgDia = bpLogs.length > 0 ? Math.round(bpLogs.reduce((acc, curr) => acc + parseInt(curr.bp.split('/')[1]), 0) / bpLogs.length) : 'N/A';

      const takenMeds = meds.filter(m => m.taken).length;
      const compliancePercent = meds.length > 0 ? Math.round((takenMeds / meds.length) * 100) : 100;

      assistantText = `CLINICAL RECORDBANK SUMMARY FOR DR. RAMIREZ:
- Patient Name: ${profile?.name || 'Patient'}
- Chronic Conditions: ${profile?.conditions}
- Average Glucose (Last 7 Logs): ${avgGlucose} mg/dL
- Average BP: ${avgSys}/${avgDia} mmHg
- Current Medication Compliance: ${compliancePercent}%
- Target Fasting Range: ${profile?.glucoseFastingTargetMin} - ${profile?.glucoseFastingTargetMax} mg/dL
- Reported Symptoms: ${logs.slice(-5).map(l => l.symptoms).filter(s => s && s !== 'None').join(', ') || 'None'}`;
    } else {
      assistantText = `Hello. As your clinical wellness assistant, I can check patterns or explain warnings. You can ask me: \n` +
        `- "What are my predicted risks?"\n` +
        `- "I feel dizzy / have a headache"\n` +
        `- "Check my medication compliance"`;
    }

    const assistantMsg = {
      sender: 'assistant',
      text: assistantText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category: '[CLINICAL]'
    };

    setChatMessages(currentMessages => [...currentMessages, assistantMsg]);
    await addMessage(assistantMsg);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    processCompanionQuery(chatInput);
    setChatInput('');
  };

  const handleClearChat = async () => {
    if (window.confirm('Clear all conversation history?')) {
      await clearMessages();
      setChatMessages([]);
    }
  };

  // 4. SVG Chart Points Calculator
  const getChartDataPoints = () => {
    if (logs.length === 0) return [];
    
    // Sort logs by date order if needed
    // Map logs to coordinates inside 0-500 X, 0-150 Y grid
    const chartLogs = [...logs].slice(-7); // Last 7 entries
    
    return chartLogs.map((log, idx) => {
      const x = 50 + (idx * 65); // Distributed along X
      let y = 150; // Default bottom
      let rawVal = 0;

      if (graphMode === 'glucose') {
        rawVal = log.glucose || 0;
        // Map 40 to 220 glucose range onto 180 to 20 Y height
        y = 180 - ((rawVal - 40) / 180) * 160;
      } else {
        // Blood pressure systolic
        rawVal = log.bp ? parseInt(log.bp.split('/')[0]) : 0;
        // Map 80 to 180 BP range onto 180 to 20 Y height
        y = 180 - ((rawVal - 80) / 100) * 160;
      }

      return { x, y, rawVal, date: log.date };
    });
  };

  const points = getChartDataPoints();
  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div>
      {/* Dashboard Top Header Bar */}
      <header className="dashboard-header">
        <div className="user-badge">
          <div className="avatar-circle">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : 'P'}
          </div>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{profile?.name || 'Patient'}</h2>
            <span className="text-muted text-sm">{profile?.conditions || 'Chronic Conditions'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn-secondary" onClick={() => setIsPromptLabOpen(true)}>
            💡 Consult Prompt Lab
          </button>
          <button className="btn-danger" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="dashboard-main">
        {/* Left Side: Analytics & Logs */}
        <div className="dashboard-left-panel">
          
          {/* Wellness Score & Streak Metrics */}
          <div className="metrics-row">
            <div className="glass-panel metric-card">
              <span className="metric-label">Wellness Score</span>
              <span className="metric-value">{wellnessScore}%</span>
              <span className={`metric-status ${wellnessScore >= 80 ? 'success' : wellnessScore >= 60 ? 'warning' : 'danger'}`}>
                {wellnessScore >= 80 ? 'Excellent Adherence' : wellnessScore >= 60 ? 'Moderate Risk' : 'High Risk Alert'}
              </span>
            </div>

            <div className="glass-panel metric-card">
              <span className="metric-label">Logging Streak</span>
              <span className="metric-value">{streakDays} Days</span>
              <span className="metric-status success">Active Schedule</span>
            </div>

            <div className="glass-panel metric-card">
              <span className="metric-label">Fasting Glucose</span>
              <span className="metric-value">{latestGlucose}</span>
              {lastLog && lastLog.glucose !== null && (
                <span className={`metric-status ${lastLog.glucose >= (profile?.glucoseFastingTargetMin || 80) && lastLog.glucose <= (profile?.glucoseFastingTargetMax || 130) ? 'success' : 'danger'}`}>
                  {lastLog.glucose >= (profile?.glucoseFastingTargetMin || 80) && lastLog.glucose <= (profile?.glucoseFastingTargetMax || 130) ? 'In Range' : 'Out of Target'}
                </span>
              )}
            </div>

            <div className="glass-panel metric-card">
              <span className="metric-label">Blood Pressure</span>
              <span className="metric-value">{latestBp}</span>
              <span className="metric-status warning">{profile?.bpStage || 'Normal'}</span>
            </div>
          </div>

          {/* Clinical Risk & Correlation Forecast Banners */}
          <div className="glass-panel alert-banner-container">
            <h3 className="heading-card">Clinical Forecast & Correlation Engine</h3>
            
            {/* Direct Warnings / Regressions */}
            {analysis.alerts.length === 0 && analysis.correlations.length === 0 && (
              <p className="text-secondary text-sm">
                No active clinical risks, 48-hour critical forecasts, or symptom-metric correlations identified today.
              </p>
            )}

            {analysis.alerts.map((alert, i) => {
              const isCritical = alert.includes('CRITICAL') || alert.includes('🚨');
              return (
                <div key={`alert-${i}`} className={`alert-banner ${isCritical ? 'danger' : 'warning'}`}>
                  <div>
                    <div className="alert-banner-title">{isCritical ? '🚨 Critical Wellness Alert' : '⚠️ Trend Prediction'}</div>
                    <div>{alert}</div>
                  </div>
                </div>
              );
            })}

            {/* Pattern correlations */}
            {analysis.correlations.map((cor, i) => (
              <div key={`cor-${i}`} className="alert-banner" style={{ backgroundColor: 'var(--color-info-bg)', borderColor: 'rgba(59, 130, 246, 0.2)', color: 'var(--text-primary)' }}>
                <div>
                  <div className="alert-banner-title" style={{ color: 'var(--color-info)' }}>🔍 Clinical Correlation Mapping</div>
                  <div>{cor}</div>
                </div>
              </div>
            ))}

            {analysis.insights.map((ins, i) => (
              <div key={`ins-${i}`} style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', paddingLeft: '8px', borderLeft: '3px solid var(--primary)' }}>
                {ins}
              </div>
            ))}
          </div>

          {/* Advanced SVG Line Chart Panel */}
          <div className="glass-panel">
            <div className="flex-between">
              <h3 className="heading-card">Clinical Curves</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`btn-secondary ${graphMode === 'glucose' ? 'active' : ''}`}
                  onClick={() => setGraphMode('glucose')}
                  style={{ padding: '6px 12px', fontSize: '0.85rem', borderColor: graphMode === 'glucose' ? 'var(--primary)' : '' }}
                >
                  Glucose
                </button>
                <button 
                  className={`btn-secondary ${graphMode === 'bp' ? 'active' : ''}`}
                  onClick={() => setGraphMode('bp')}
                  style={{ padding: '6px 12px', fontSize: '0.85rem', borderColor: graphMode === 'bp' ? 'var(--primary)' : '' }}
                >
                  Systolic BP
                </button>
              </div>
            </div>

            <div className="chart-svg-container">
              {logs.length < 2 ? (
                <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)' }}>
                  Log at least 2 days of biometrics to plot trends.
                </div>
              ) : (
                <svg width="100%" height="100%" viewBox="0 0 500 200" style={{ overflow: 'visible' }}>
                  {/* Grid Lines */}
                  <line x1="50" y1="20" x2="450" y2="20" stroke="var(--border-light)" strokeDasharray="3" />
                  <line x1="50" y1="100" x2="450" y2="100" stroke="var(--border-light)" strokeDasharray="3" />
                  <line x1="50" y1="180" x2="450" y2="180" stroke="var(--border-color)" />

                  {/* Graph Target Bounds */}
                  {graphMode === 'glucose' ? (
                    <>
                      {/* Hyper Bound line (130 max) */}
                      <line x1="50" y1={180 - ((130 - 40) / 180) * 160} x2="450" y2={180 - ((130 - 40) / 180) * 160} stroke="rgba(245, 158, 11, 0.4)" strokeDasharray="4 2" />
                      {/* Hypo Bound line (70 min) */}
                      <line x1="50" y1={180 - ((70 - 40) / 180) * 160} x2="450" y2={180 - ((70 - 40) / 180) * 160} stroke="rgba(239, 68, 68, 0.4)" strokeDasharray="4 2" />
                    </>
                  ) : (
                    /* Systolic target line (130 max) */
                    <line x1="50" y1={180 - ((130 - 80) / 100) * 160} x2="450" y2={180 - ((130 - 80) / 100) * 160} stroke="rgba(245, 158, 11, 0.4)" strokeDasharray="4 2" />
                  )}

                  {/* Trend Line */}
                  <polyline
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="3"
                    points={polylinePoints}
                  />

                  {/* Data Point Circles and Values */}
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

          {/* Quick Check-in Logger */}
          <div className="glass-panel">
            <h3 className="heading-card" style={{ marginBottom: '16px' }}>Quick Biometric Entry</h3>
            <form onSubmit={handleQuickLog} className="quick-logger-form">
              <div>
                <label className="input-label" htmlFor="quick-glucose">Glucose (mg/dL)</label>
                <input 
                  id="quick-glucose"
                  type="number" 
                  className="input-field" 
                  placeholder="e.g. 115"
                  value={logGlucose}
                  onChange={e => setLogGlucose(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label className="input-label" htmlFor="quick-sys">Systolic</label>
                  <input 
                    id="quick-sys"
                    type="number" 
                    className="input-field" 
                    placeholder="120"
                    value={logBpSys}
                    onChange={e => setLogBpSys(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="quick-dia">Diastolic</label>
                  <input 
                    id="quick-dia"
                    type="number" 
                    className="input-field" 
                    placeholder="80"
                    value={logBpDia}
                    onChange={e => setLogBpDia(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="input-label" htmlFor="quick-symptoms">Symptoms Logged</label>
                <input 
                  id="quick-symptoms"
                  type="text" 
                  className="input-field" 
                  placeholder="Headache, dizzy, none..."
                  value={logSymptoms}
                  onChange={e => setLogSymptoms(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="quick-meal" className="text-sm text-secondary">Breakfast:</label>
                  <select 
                    id="quick-meal"
                    className="input-field" 
                    style={{ padding: '6px 12px', width: 'auto' }}
                    value={logMeal}
                    onChange={e => setLogMeal(e.target.value)}
                  >
                    <option value="yes">Consumed</option>
                    <option value="skipped">Skipped</option>
                  </select>
                </div>
                
                <button type="submit" className="btn-primary">
                  Log Entry
                </button>
              </div>
            </form>
          </div>

          {/* Historical Logs List */}
          <div className="glass-panel">
            <h3 className="heading-card">Timeline Logs</h3>
            <div className="timeline-list">
              {logs.slice().reverse().map((log, idx) => {
                const isOutOfRange = (log.glucose && (log.glucose < (profile?.glucoseFastingTargetMin || 80) || log.glucose > (profile?.glucoseFastingTargetMax || 130))) || 
                                     (log.bp && (parseInt(log.bp.split('/')[0]) > (profile?.bpSystolicTargetMax || 130)));
                return (
                  <div className={`timeline-node ${!isOutOfRange ? 'active' : ''}`} key={`log-${idx}`}>
                    <div className="timeline-card">
                      <div>
                        <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{log.date}</strong>
                        <div className="text-muted text-sm">{log.meal === 'skipped' ? '⚠️ Skipped Breakfast' : 'Breakfast Consumed'}</div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        {log.glucose !== null && (
                          <div>
                            <span className="text-muted text-sm">Glucose:</span>
                            <div style={{ fontWeight: '600', color: (log.glucose < 70 || log.glucose > 130) ? 'var(--color-danger)' : 'var(--text-primary)' }}>{log.glucose} mg/dL</div>
                          </div>
                        )}
                        {log.bp && (
                          <div>
                            <span className="text-muted text-sm">Blood Pressure:</span>
                            <div style={{ fontWeight: '600', color: (parseInt(log.bp.split('/')[0]) >= 140) ? 'var(--color-danger)' : 'var(--text-primary)' }}>{log.bp} mmHg</div>
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span className="text-muted text-sm">Symptoms:</span>
                        <div className="badge badge-secondary" style={{ display: 'block', width: 'fit-content', marginLeft: 'auto', marginTop: '4px' }}>
                          {log.symptoms}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Profile & Chatbot */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Prescription Compliance Manager */}
          <div className="glass-panel">
            <h3 className="heading-card">Active Prescriptions</h3>
            <p className="text-secondary text-sm">Toggle to log daily medication ingestion compliance.</p>
            <div className="meds-grid">
              {meds.map(med => (
                <div className={`med-item ${med.taken ? 'taken' : ''}`} key={med.id} onClick={() => handleToggleMed(med.id)}>
                  <div className="med-item-info">
                    <strong style={{ color: 'var(--text-primary)' }}>{med.name} {med.dose}</strong>
                    <span className="text-muted text-sm">{med.frequency}</span>
                  </div>
                  <div className={`checkbox-custom ${med.taken ? 'checked' : ''}`}>
                    {med.taken && '✓'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Physician details */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 className="heading-card">Physician Contacts</h3>
            <div>
              <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{profile?.physicianName || 'Dr. Ramirez'}</strong>
              <span className="text-muted text-sm">{profile?.physicianClinic || 'Oakridge Medical'}</span>
            </div>
            <a href={`tel:${profile?.physicianPhone || '555-0147'}`} className="btn-secondary" style={{ justifyContent: 'center', fontSize: '0.9rem' }}>
              📞 Call Clinic ({profile?.physicianPhone || '555-0147'})
            </a>
          </div>

          {/* Chat Companion */}
          <div className="glass-panel chat-companion-card">
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 className="heading-card">Clinical Companion</h3>
              <button 
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}
                onClick={handleClearChat}
              >
                Clear History
              </button>
            </div>

            <div className="chat-messages-container">
              {chatMessages.map((msg, i) => (
                <div className={`chat-message ${msg.sender}`} key={`msg-${i}`}>
                  {msg.category && (
                    <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'bold', color: msg.sender === 'user' ? '#fff' : 'var(--primary)', marginBottom: '4px' }}>
                      {msg.category}
                    </span>
                  )}
                  <div style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
                  <span style={{ display: 'block', fontSize: '0.65rem', textAlign: 'right', marginTop: '4px', opacity: 0.7 }}>
                    {msg.timestamp}
                  </span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-bar">
              <input 
                type="text" 
                className="input-field" 
                placeholder="Ask about symptoms, patterns..." 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
              />
              <button type="submit" className="btn-primary">
                Send
              </button>
            </form>
          </div>
        </div>
      </main>

      <PromptLab 
        isOpen={isPromptLabOpen} 
        onClose={() => setIsPromptLabOpen(false)} 
        onSelectPrompt={processCompanionQuery} 
      />
    </div>
  );
}
