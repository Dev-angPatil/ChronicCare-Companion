import React, { useState, useEffect, useRef } from 'react';
import { getProfile, getLogs, addLog, getMedications, updateMedication, deleteMedication, getMessages, addMessage, clearMessages, logUserActivity, getAnalysisData, getPatientLinks, respondToLink, getGeminiResponse, getOfflineQueueCount, syncOfflineQueue, seedDemoScenario } from '../utils/db.js';
import PromptLab from './PromptLab.jsx';
import DemoControlDrawer from './DemoControlDrawer.jsx';

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
  const [logAnxiety, setLogAnxiety] = useState(5);
  const [logHeartRate, setLogHeartRate] = useState('');
  const [logPeakFlow, setLogPeakFlow] = useState('');
  const [logInhalerPuffs, setLogInhalerPuffs] = useState('');
  const [logPain, setLogPain] = useState(2);
  const [logMeal, setLogMeal] = useState('yes');
  const [logSymptoms, setLogSymptoms] = useState('');

  // Graph Toggle
  const [graphMode, setGraphMode] = useState('glucose'); // 'glucose' or 'bp'

  // Threshold Tuning States
  const [isTuningOpen, setIsTuningOpen] = useState(false);
  const [tuningGlucoseMin, setTuningGlucoseMin] = useState(80);
  const [tuningGlucoseMax, setTuningGlucoseMax] = useState(130);
  const [tuningBpSysMax, setTuningBpSysMax] = useState(130);
  const [tuningBpDiaMax, setTuningBpDiaMax] = useState(80);

  // Connection/Link Requests State
  const [linkRequests, setLinkRequests] = useState([]);

  // Bluetooth Sync Simulator States
  const [isBtModalOpen, setIsBtModalOpen] = useState(false);
  const [btSyncState, setBtSyncState] = useState('idle'); // 'searching', 'found', 'syncing', 'done'
  const [btDeviceType, setBtDeviceType] = useState('none');

  // Adherence Local Notifications State
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);

  // Offline State & Cache Sync
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Breathing Coach States
  const [isBreathingModalOpen, setIsBreathingModalOpen] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState('idle'); // 'idle', 'inhale', 'hold', 'exhale', 'completed'
  const [breathingCountdown, setBreathingCountdown] = useState(4);
  const [breathingCycles, setBreathingCycles] = useState(0);

  // Clinician Report State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Android App Redesign states
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'logs' | 'meds' | 'chat' | 'profile'
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);

  // Medication CRUD States
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('Once daily');

  // Bluetooth Emulator States
  const [btSyncDeviceName, setBtSyncDeviceName] = useState('');
  const [liveBtReading, setLiveBtReading] = useState('');

  const [notification, setNotification] = useState({ show: false, title: '', body: '', type: '', data: null });
  const chatMessagesEndRef = useRef(null);

  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleNotificationAction = async (action) => {
    setNotification(n => ({ ...n, show: false }));
    
    if (action === 'take' && notification.type === 'medication') {
      const medId = notification.data?.medId;
      const targetMed = meds.find(m => m.id === medId || m.name.toLowerCase() === medId);
      if (targetMed) {
        try {
          await updateMedication({ ...targetMed, taken: true });
          await logUserActivity('compliance_update', `Marked ${targetMed.name} ${targetMed.dose} as taken via push notification.`);
          await loadAllData();
          alert(`Prescription compliance logged: ${targetMed.name} taken.`);
        } catch (err) {
          console.error('Failed to update medication via notification:', err);
        }
      } else {
        try {
          await updateMedication({ id: 'metformin', name: 'Metformin', dose: '500mg', frequency: 'Twice daily (Morning/Night)', taken: true, remainingHours: 12 });
          await logUserActivity('compliance_update', 'Marked Metformin 500mg as taken via push notification.');
          await loadAllData();
          alert('Prescription compliance logged: Metformin 500mg taken.');
        } catch (err) {
          console.error('Failed to update mock medication:', err);
        }
      }
    } else if (action === 'retest' && notification.type === 'critical_vital') {
      const bpInput = document.getElementById('quick-sys');
      if (bpInput) {
        bpInput.scrollIntoView({ behavior: 'smooth' });
        bpInput.focus();
      }
    }
  };

  useEffect(() => {
    let hideTimer;
    
    const handleTriggerNotification = (e) => {
      setNotification({
        show: true,
        title: e.detail.title,
        body: e.detail.body,
        type: e.detail.type,
        data: e.detail.data
      });
      
      if (e.detail.type !== 'medication') {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          setNotification(n => ({ ...n, show: false }));
        }, 8000);
      }
    };
    
    window.addEventListener('cc_trigger_notification', handleTriggerNotification);
    return () => {
      window.removeEventListener('cc_trigger_notification', handleTriggerNotification);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [meds]);

  // Load dashboard data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  // Network Offline & Sync listeners
  useEffect(() => {
    setOfflineQueueCount(getOfflineQueueCount());

    const handleOnline = async () => {
      setIsOffline(false);
      console.log('Network connected. Pushing offline logs to clinical database...');
      try {
        const remaining = await syncOfflineQueue();
        setOfflineQueueCount(remaining);
        if (remaining === 0) {
          await loadAllData();
        }
      } catch (err) {
        console.error('Offline logs synchronization failed:', err);
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    const handleSyncQueueUpdated = (e) => {
      setOfflineQueueCount(e.detail.count);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('cc_sync_queue_updated', handleSyncQueueUpdated);

    // Initial check
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('cc_sync_queue_updated', handleSyncQueueUpdated);
    };
  }, []);

  // Breathing Coach Timer effect
  useEffect(() => {
    if (!isBreathingModalOpen || breathingPhase === 'idle' || breathingPhase === 'completed') return;

    const timerId = setInterval(() => {
      setBreathingCountdown(prev => {
        if (prev <= 1) {
          if (breathingPhase === 'inhale') {
            setBreathingPhase('hold');
            return 4; // hold is 4 seconds
          } else if (breathingPhase === 'hold') {
            setBreathingPhase('exhale');
            return 6; // exhale is 6 seconds
          } else if (breathingPhase === 'exhale') {
            setBreathingCycles(c => {
              const nextC = c + 1;
              if (nextC >= 4) {
                setBreathingPhase('completed');
                return nextC;
              }
              return nextC;
            });
            setBreathingPhase('inhale');
            return 4; // inhale is 4 seconds
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [isBreathingModalOpen, breathingPhase]);

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

      // Fetch pending link requests for patient consent
      const linksData = await getPatientLinks();
      const pendingLinks = linksData.filter(l => l.status === 'pending');
      setLinkRequests(pendingLinks);

      if (profData) {
        setTuningGlucoseMin(profData.glucoseFastingTargetMin ?? 80);
        setTuningGlucoseMax(profData.glucoseFastingTargetMax ?? 130);
        setTuningBpSysMax(profData.bpSystolicTargetMax ?? 130);
        setTuningBpDiaMax(profData.bpDiastolicTargetMax ?? 80);

        // Load server-computed clinical analytics
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
    
    const isDiabetes = profile?.conditions?.toLowerCase().includes('diabetes');
    const isHypertension = profile?.conditions?.toLowerCase().includes('hypertension');
    const isAnxiety = profile?.conditions?.toLowerCase().includes('anxiety');
    const isAsthma = profile?.conditions?.toLowerCase().includes('asthma');
    const isPain = profile?.conditions?.toLowerCase().includes('pain');

    if (!isDiabetes && !isHypertension && !isAnxiety && !isAsthma && !isPain) {
      alert('Please configure at least one active condition in your profile settings.');
      return;
    }

    try {
      const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).replace(',', '');
      
      const newEntry = {
        date: todayStr,
        glucose: isDiabetes && logGlucose ? Number(logGlucose) : null,
        bp: (isHypertension || isAnxiety) && logBpSys && logBpDia ? `${logBpSys}/${logBpDia}` : null,
        meal: isDiabetes ? logMeal : 'n/a',
        symptoms: logSymptoms || 'None reported',
        anxietyLevel: isAnxiety ? Number(logAnxiety) : null,
        heartRate: (isAnxiety || isHypertension) && logHeartRate ? Number(logHeartRate) : null,
        peakFlow: isAsthma && logPeakFlow ? Number(logPeakFlow) : null,
        inhalerPuffs: isAsthma && logInhalerPuffs ? Number(logInhalerPuffs) : null,
        painLevel: isPain ? Number(logPain) : null
      };

      await addLog(newEntry);
      await logUserActivity('quick_log', `Logged vitals: Sugar=${logGlucose || 'N/A'}, BP=${logBpSys ? logBpSys + '/' + logBpDia : 'N/A'}, Anxiety=${logAnxiety}, Pain=${logPain}`);
      
      // Clear forms
      setLogGlucose('');
      setLogBpSys('');
      setLogBpDia('');
      setLogAnxiety(5);
      setLogHeartRate('');
      setLogPeakFlow('');
      setLogInhalerPuffs('');
      setLogPain(2);
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

  const handleDeleteMed = async (e, medId, name) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to remove the prescription for ${name}?`)) {
      try {
        await deleteMedication(medId);
        await logUserActivity('delete_medication', `Deleted prescription: ${name}`);
        await loadAllData();
      } catch (err) {
        console.error('Failed to delete medication:', err);
        alert('Error deleting medication: ' + err.message);
      }
    }
  };

  const handleAddMed = async (e) => {
    e.preventDefault();
    if (!newMedName.trim() || !newMedDose.trim()) {
      alert('Please fill out all prescription fields.');
      return;
    }
    try {
      const medId = 'med_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
      const newMed = {
        id: medId,
        name: newMedName.trim(),
        dose: newMedDose.trim(),
        frequency: newMedFreq,
        taken: false,
        remainingHours: 24
      };
      await updateMedication(newMed);
      await logUserActivity('add_medication', `Added prescription: ${newMed.name} ${newMed.dose}`);
      setNewMedName('');
      setNewMedDose('');
      setNewMedFreq('Once daily');
      setIsAddingMed(false);
      await loadAllData();
    } catch (err) {
      console.error('Failed to add prescription:', err);
      alert('Error saving prescription: ' + err.message);
    }
  };

  const getVitalsSummaryStats = () => {
    const recentLogs = logs.slice(-7);
    if (recentLogs.length === 0) return null;
    
    const stats = {
      glucose: { min: Infinity, max: -Infinity, sum: 0, count: 0 },
      sys: { min: Infinity, max: -Infinity, sum: 0, count: 0 },
      dia: { min: Infinity, max: -Infinity, sum: 0, count: 0 },
      anxiety: { min: Infinity, max: -Infinity, sum: 0, count: 0 },
      hr: { min: Infinity, max: -Infinity, sum: 0, count: 0 },
      pf: { min: Infinity, max: -Infinity, sum: 0, count: 0 },
      pain: { min: Infinity, max: -Infinity, sum: 0, count: 0 }
    };
    
    recentLogs.forEach(l => {
      if (l.glucose !== null && l.glucose !== undefined) {
        stats.glucose.min = Math.min(stats.glucose.min, l.glucose);
        stats.glucose.max = Math.max(stats.glucose.max, l.glucose);
        stats.glucose.sum += l.glucose;
        stats.glucose.count++;
      }
      if (l.bp) {
        const parts = l.bp.split('/');
        if (parts.length === 2) {
          const bpSys = parseInt(parts[0]);
          const bpDia = parseInt(parts[1]);
          if (!isNaN(bpSys) && !isNaN(bpDia)) {
            stats.sys.min = Math.min(stats.sys.min, bpSys);
            stats.sys.max = Math.max(stats.sys.max, bpSys);
            stats.sys.sum += bpSys;
            stats.sys.count++;
            
            stats.dia.min = Math.min(stats.dia.min, bpDia);
            stats.dia.max = Math.max(stats.dia.max, bpDia);
            stats.dia.sum += bpDia;
            stats.dia.count++;
          }
        }
      }
      if (l.anxietyLevel !== null && l.anxietyLevel !== undefined) {
        stats.anxiety.min = Math.min(stats.anxiety.min, l.anxietyLevel);
        stats.anxiety.max = Math.max(stats.anxiety.max, l.anxietyLevel);
        stats.anxiety.sum += l.anxietyLevel;
        stats.anxiety.count++;
      }
      if (l.heartRate !== null && l.heartRate !== undefined) {
        stats.hr.min = Math.min(stats.hr.min, l.heartRate);
        stats.hr.max = Math.max(stats.hr.max, l.heartRate);
        stats.hr.sum += l.heartRate;
        stats.hr.count++;
      }
      if (l.peakFlow !== null && l.peakFlow !== undefined) {
        stats.pf.min = Math.min(stats.pf.min, l.peakFlow);
        stats.pf.max = Math.max(stats.pf.max, l.peakFlow);
        stats.pf.sum += l.peakFlow;
        stats.pf.count++;
      }
      if (l.painLevel !== null && l.painLevel !== undefined) {
        stats.pain.min = Math.min(stats.pain.min, l.painLevel);
        stats.pain.max = Math.max(stats.pain.max, l.painLevel);
        stats.pain.sum += l.painLevel;
        stats.pain.count++;
      }
    });
    
    Object.keys(stats).forEach(k => {
      if (stats[k].count === 0) {
        stats[k].min = 0;
        stats[k].max = 0;
      }
    });
    
    return stats;
  };

  const getTrendDirection = (metricName) => {
    const recentLogs = [...logs].slice(-7);
    if (recentLogs.length < 3) return 'Stable ➡️';
    
    const values = recentLogs.map(l => {
      if (metricName === 'glucose') return l.glucose;
      if (metricName === 'bp') return l.bp ? parseInt(l.bp.split('/')[0]) : null;
      if (metricName === 'anxiety') return l.anxietyLevel;
      if (metricName === 'pf') return l.peakFlow;
      if (metricName === 'pain') return l.painLevel;
      return null;
    }).filter(v => v !== null && v !== undefined);

    if (values.length < 3) return 'Stable ➡️';
    
    const half = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, half);
    const secondHalf = values.slice(half);
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const diff = avgSecond - avgFirst;
    const threshold = metricName === 'glucose' ? 5 : metricName === 'bp' ? 3 : 0.5;
    
    if (diff > threshold) return 'Rising 📈';
    if (diff < -threshold) return 'Improving 📉';
    return 'Stable ➡️';
  };

  const getAnxietyHRCorrelation = () => {
    const hrAndAnxietyLogs = logs.filter(l => l.heartRate !== null && l.anxietyLevel !== null);
    if (hrAndAnxietyLogs.length < 3) return 'Insufficient data';
    
    const avgHR = hrAndAnxietyLogs.reduce((acc, l) => acc + l.heartRate, 0) / hrAndAnxietyLogs.length;
    const avgAnxiety = hrAndAnxietyLogs.reduce((acc, l) => acc + l.anxietyLevel, 0) / hrAndAnxietyLogs.length;
    
    let matchedDays = 0;
    let highAnxietyDays = 0;
    hrAndAnxietyLogs.forEach(l => {
      if (l.anxietyLevel >= avgAnxiety) {
        highAnxietyDays++;
        if (l.heartRate >= avgHR) {
          matchedDays++;
        }
      }
    });
    
    if (highAnxietyDays === 0) return 'Stable resting heart rate across levels';
    const percent = Math.round((matchedDays / highAnxietyDays) * 100);
    return `Resting heart rate elevates on high anxiety days (vagal tone coupling: ${percent}%)`;
  };

  const startBreathing = () => {
    setBreathingPhase('inhale');
    setBreathingCountdown(4);
    setBreathingCycles(0);
  };

  const stopBreathing = () => {
    setBreathingPhase('idle');
    setBreathingCountdown(4);
  };

  const runHighFidelitySimulatedSync = (device) => {
    setBtDeviceType(device.type);
    setBtSyncDeviceName(device.name);
    setBtSyncState('searching');
    setLiveBtReading('');
    
    setTimeout(() => {
      setBtSyncState('found');
      
      setTimeout(() => {
        setBtSyncState('syncing');
        
        let counter = 0;
        const intervalId = setInterval(() => {
          counter++;
          if (device.type === 'glucometer') {
            const val = Math.floor(Math.random() * 15) + 95;
            setLiveBtReading(`${val} mg/dL`);
          } else if (device.type === 'heart_rate') {
            const val = Math.floor(Math.random() * 8) + 68;
            setLiveBtReading(`${val} bpm`);
          } else {
            const sys = Math.floor(Math.random() * 10) + 115;
            const dia = Math.floor(Math.random() * 6) + 75;
            setLiveBtReading(`${sys}/${dia} mmHg`);
          }
        }, 300);
        
        setTimeout(() => {
          clearInterval(intervalId);
          setBtSyncState('done');
          
          if (device.type === 'glucometer') {
            const val = Math.floor(Math.random() * 16) + 95;
            setLogGlucose(val.toString());
          } else if (device.type === 'heart_rate') {
            const val = Math.floor(Math.random() * 10) + 72;
            setLogHeartRate(val.toString());
          } else {
            const sys = Math.floor(Math.random() * 10) + 118;
            const dia = Math.floor(Math.random() * 6) + 76;
            setLogBpSys(sys.toString());
            setLogBpDia(dia.toString());
            if (profile?.conditions?.toLowerCase().includes('anxiety')) {
              const hrVal = Math.floor(Math.random() * 10) + 72;
              setLogHeartRate(hrVal.toString());
            }
          }
          
          setTimeout(() => {
            setIsBtModalOpen(false);
            setBtSyncState('idle');
          }, 1800);
          
        }, 3000);
      }, 1200);
    }, 1200);
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

    try {
      // Attempt to query Gemini backend
      const response = await getGeminiResponse(currentMessages, {
        profile,
        meds,
        logs
      });
      assistantText = response.text;
    } catch (err) {
      console.warn('Gemini Clinical Companion query failed. Falling back to local rules:', err);
      
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
      } else if (textLower.includes('anxious') || textLower.includes('anxiety') || textLower.includes('panic') || textLower.includes('stress')) {
        assistantText = `Anxiety and stress are tracked using the validated GAD-7 clinical scale. Your last recorded anxiety score was ${lastLog?.anxietyLevel ?? 'N/A'}/21, with a resting heart rate of ${lastLog?.heartRate ?? 'N/A'} bpm. `;
        if (lastLog?.anxietyLevel >= 10) {
          assistantText += `Since your anxiety is currently elevated, clinical recommendations suggest performing paced diaphragmatic breathing (inhaling for 4 seconds, holding for 4, and exhaling for 6) to activate the vagus nerve and slow heart rate.`;
        } else {
          assistantText += `Your stress indicators are in a healthy range. Continue tracking daily.`;
        }
      } else if (textLower.includes('asthma') || textLower.includes('breath') || textLower.includes('wheez') || textLower.includes('peak flow') || textLower.includes('inhaler')) {
        assistantText = `Asthma control is monitored via daily Peak Flow (L/min) and rescue inhaler count. Your latest Peak Flow was ${lastLog?.peakFlow ?? 'N/A'} L/min, and you logged ${lastLog?.inhalerPuffs ?? '0'} rescue inhaler puffs. `;
        if (lastLog?.peakFlow && lastLog.peakFlow < 350) {
          assistantText += `WARNING: A peak flow below 350 L/min indicates critical airway obstruction. Please utilize your rescue inhaler and notify your physician.`;
        } else {
          assistantText += `Your breathing indicators look stable. Regular peak expiratory flow is great for anticipating airway constriction.`;
        }
      } else if (textLower.includes('pain') || textLower.includes('hurt') || textLower.includes('ache')) {
        assistantText = `Chronic pain is measured on the NRS 0-10 intensity scale. Your latest pain intensity was logged at ${lastLog?.painLevel ?? 'N/A'}/10. `;
        if (lastLog?.painLevel >= 7) {
          assistantText += `Because your pain is severe, clinical care paths advise limiting physical exertion, employing local thermal therapy, and pacing activities. Contact your physician if it persists.`;
        } else {
          assistantText += `Your pain level is currently managed. Remember to practice pacing your activities.`;
        }
      } else if (textLower.includes('risk') || textLower.includes('predict') || textLower.includes('forecast')) {
        if (analysis.alerts.length > 0) {
          assistantText = `Based on my 48-hour forecasting engine, here are active clinical predictions: \n\n` + 
            analysis.alerts.map(a => `- ${a}`).join('\n') + `\n\nEnsure compliance with your ${meds.filter(m => !m.taken).length} remaining prescriptions today.`;
        } else {
          assistantText = `Your chronic care metrics are tracking stably with a wellness compliance score of ${wellnessScore}/100. No critical 48-hour forecasting risks detected.`;
        }
      } else if (textLower.includes('medication') || textLower.includes('metformin') || textLower.includes('amlodipine')) {
        const untaken = meds.filter(m => !m.taken);
        if (untaken.length > 0) {
          assistantText = `You have ${untaken.length} medication(s) remaining for today: ${untaken.map(m => m.name).join(', ')}. Please mark them as taken once consumed.`;
        } else {
          assistantText = `Excellent! All of today's medications (${meds.map(m => m.name).join(', ')}) have been marked as taken.`;
        }
      } else if (textLower.includes('appointment') || textLower.includes('ramirez') || textLower.includes('summarize')) {
        const avgGlucose = logs.filter(l => l.glucose !== null).length > 0 ? Math.round(logs.filter(l => l.glucose !== null).reduce((acc, c) => acc + c.glucose, 0) / logs.filter(l => l.glucose !== null).length) : 'N/A';
        const avgHR = logs.filter(l => l.heartRate !== null).length > 0 ? Math.round(logs.filter(l => l.heartRate !== null).reduce((acc, c) => acc + c.heartRate, 0) / logs.filter(l => l.heartRate !== null).length) : 'N/A';
        const avgPain = logs.filter(l => l.painLevel !== null).length > 0 ? Math.round(logs.filter(l => l.painLevel !== null).reduce((acc, c) => acc + c.painLevel, 0) / logs.filter(l => l.painLevel !== null).length) : 'N/A';

        assistantText = `CLINICAL RECORDBANK SUMMARY FOR DR. RAMIREZ:
- Patient Name: ${profile?.name || 'Patient'}
- Chronic Conditions: ${profile?.conditions}
- Average Glucose: ${avgGlucose} mg/dL
- Average Heart Rate: ${avgHR} bpm
- Average Pain Scale: ${avgPain}/10
- Target Fasting Range: ${profile?.glucoseFastingTargetMin} - ${profile?.glucoseFastingTargetMax} mg/dL
- Active Symptoms: ${logs.slice(-5).map(l => l.symptoms).filter(s => s && s !== 'None').join(', ') || 'None'}`;
      } else {
        assistantText = `Hello. As your clinical wellness assistant, I can check patterns or explain warnings. You can ask me: \n` +
          `- "What are my predicted risks?"\n` +
          `- "I feel anxious / have panic symptoms"\n` +
          `- "Check my asthma peak flow or inhaler use"\n` +
          `- "How is my chronic pain level?"\n` +
          `- "I feel dizzy / have a headache"\n` +
          `- "Check my medication compliance"`;
      }
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

  const handleUpdateThresholds = async (e) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const updatedProfile = {
        name: profile.name,
        conditions: profile.conditions,
        physicianName: profile.physicianName,
        physicianPhone: profile.physicianPhone,
        physicianClinic: profile.physicianClinic,
        glucoseFastingTargetMin: Number(tuningGlucoseMin),
        glucoseFastingTargetMax: Number(tuningGlucoseMax),
        bpSystolicTargetMax: Number(tuningBpSysMax),
        bpDiastolicTargetMax: Number(tuningBpDiaMax),
        bpStage: profile.bpStage || 'Normal'
      };

      await setProfile(updatedProfile);
      await logUserActivity('update_thresholds', `Updated target thresholds: Glucose=${tuningGlucoseMin}-${tuningGlucoseMax}, BP=${tuningBpSysMax}/${tuningBpDiaMax}`);
      setIsTuningOpen(false);
      await loadAllData();
    } catch (err) {
      console.error('Failed to update thresholds:', err);
      alert('Error updating thresholds: ' + err.message);
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      alert('No logs available to export.');
      return;
    }
    const headers = [
      'Date', 'Glucose (mg/dL)', 'Blood Pressure (mmHg)', 'Meal Breakfast', 
      'Anxiety Level (GAD-7)', 'Heart Rate (bpm)', 'Peak Flow (L/min)', 
      'Inhaler Puffs', 'Pain Level (NRS)', 'Symptoms'
    ];
    const rows = logs.map(log => [
      log.date || '',
      log.glucose !== null && log.glucose !== undefined ? log.glucose : '',
      log.bp || '',
      log.meal || '',
      log.anxietyLevel !== null && log.anxietyLevel !== undefined ? log.anxietyLevel : '',
      log.heartRate !== null && log.heartRate !== undefined ? log.heartRate : '',
      log.peakFlow !== null && log.peakFlow !== undefined ? log.peakFlow : '',
      log.inhalerPuffs !== null && log.inhalerPuffs !== undefined ? log.inhalerPuffs : '',
      log.painLevel !== null && log.painLevel !== undefined ? log.painLevel : '',
      log.symptoms || ''
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `clinical_logs_${profile?.name || 'patient'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLinkRespond = async (physicianId, accept) => {
    try {
      await respondToLink(physicianId, accept);
      await loadAllData();
      alert(accept ? 'Physician clinic connection approved!' : 'Connection request declined.');
    } catch (err) {
      console.error('Failed to respond to link request:', err);
      alert('Error updating clinic connection: ' + err.message);
    }
  };

  const startBtSync = (type) => {
    setBtDeviceType(type);
    setBtSyncState('searching');
    
    setTimeout(() => {
      setBtSyncState('found');
      
      setTimeout(() => {
        setBtSyncState('syncing');
        
        setTimeout(() => {
          setBtSyncState('done');
          
          if (type === 'glucometer') {
            const simulatedGlucose = Math.floor(Math.random() * 36) + 90;
            setLogGlucose(simulatedGlucose.toString());
          } else {
            const simulatedSys = Math.floor(Math.random() * 21) + 115;
            const simulatedDia = Math.floor(Math.random() * 11) + 75;
            setLogBpSys(simulatedSys.toString());
            setLogBpDia(simulatedDia.toString());
            if (profile?.conditions?.toLowerCase().includes('anxiety') || profile?.conditions?.toLowerCase().includes('hypertension')) {
              const simulatedHR = Math.floor(Math.random() * 20) + 65;
              setLogHeartRate(simulatedHR.toString());
            }
          }
          
          setTimeout(() => {
            setIsBtModalOpen(false);
            setBtSyncState('idle');
          }, 1500);
        }, 1800);
      }, 1500);
    }, 2000);
  };

  useEffect(() => {
    const storedReminders = localStorage.getItem('cc_reminders') === 'enabled';
    setIsNotificationEnabled(storedReminders);
  }, []);

  useEffect(() => {
    if (!isNotificationEnabled) return;

    const demoTimer = setTimeout(() => {
      sendLocalNotification(
        'Medication & Biometrics Check-in',
        'Friendly daily reminder to log your glucose level and record Metformin ingestion.'
      );
    }, 20000);

    return () => clearTimeout(demoTimer);
  }, [isNotificationEnabled]);

  const sendLocalNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.svg'
      });
    }
  };

  const handleToggleReminders = async () => {
    if (!isNotificationEnabled) {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          localStorage.setItem('cc_reminders', 'enabled');
          setIsNotificationEnabled(true);
          sendLocalNotification('Reminders Activated', 'You will receive notifications to keep up with your logging schedule.');
        } else {
          alert('Permission denied. Please enable notifications in your browser settings.');
        }
      } else {
        alert('This browser does not support notifications.');
      }
    } else {
      localStorage.setItem('cc_reminders', 'disabled');
      setIsNotificationEnabled(false);
    }
  };

  // 4. SVG Chart Points Calculator
  const getChartDataPoints = () => {
    if (logs.length === 0) return [];
    const chartLogs = [...logs].slice(-7);
    const validPoints = [];

    chartLogs.forEach((log, idx) => {
      const x = 50 + (idx * 65);
      let y = 150;
      let rawVal = 0;
      let hasVal = false;

      if (graphMode === 'glucose') {
        if (log.glucose !== null && log.glucose !== undefined) {
          rawVal = log.glucose;
          y = 180 - ((rawVal - 40) / 180) * 160;
          hasVal = true;
        }
      } else {
        if (log.bp) {
          const sys = parseInt(log.bp.split('/')[0]);
          if (!isNaN(sys)) {
            rawVal = sys;
            y = 180 - ((rawVal - 80) / 100) * 160;
            hasVal = true;
          }
        }
      }
      if (hasVal) {
        validPoints.push({ x, y, rawVal, date: log.date });
      }
    });

    return validPoints;
  };

  const points = getChartDataPoints();
  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Android Push Notification Banner overlay */}
      <div className={`android-notification-wrapper ${notification.show ? 'show' : ''}`}>
        <div className="android-notification-card">
          <div className="android-notification-header">
            <div className="android-notification-icon">🩺</div>
            <div className="android-notification-title">{notification.title}</div>
            <div className="android-notification-time">now</div>
          </div>
          <div className="android-notification-body">
            {notification.body}
          </div>
          <div className="android-notification-actions">
            {notification.type === 'medication' ? (
              <>
                <button 
                  type="button" 
                  className="android-notification-btn secondary"
                  onClick={() => handleNotificationAction('dismiss')}
                >
                  Dismiss
                </button>
                <button 
                  type="button" 
                  className="android-notification-btn"
                  onClick={() => handleNotificationAction('take')}
                >
                  Take Now
                </button>
              </>
            ) : (
              <>
                <button 
                  type="button" 
                  className="android-notification-btn secondary"
                  onClick={() => handleNotificationAction('dismiss')}
                >
                  Dismiss
                </button>
                {notification.data?.alertId === 'bp_spike' && (
                  <button 
                    type="button" 
                    className="android-notification-btn"
                    onClick={() => handleNotificationAction('retest')}
                  >
                    Retest
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top App Bar */}
      <header className="dashboard-header" style={{ height: '56px', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="avatar-circle" style={{ width: '32px', height: '32px', fontSize: '14px', border: '1px solid var(--border-color)' }}>
            {profile?.name ? profile.name.charAt(0).toUpperCase() : 'P'}
          </div>
          <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--ink)' }}>
            {activeTab === 'home' && 'Companion'}
            {activeTab === 'logs' && 'Vitals Logs'}
            {activeTab === 'meds' && 'Prescriptions'}
            {activeTab === 'chat' && 'Clinical AI'}
            {activeTab === 'profile' && 'Target Tuning'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div 
            className="no-print"
            style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: isOffline ? '#f59e0b' : '#2e7d32', 
              display: 'inline-block' 
            }}
            title={isOffline ? 'Offline Mode' : 'Connected to Clinical Cloud'}
          />
          {offlineQueueCount > 0 && !isOffline && (
            <button 
              type="button"
              className="btn-primary animate-pulse no-print"
              style={{ height: '28px', fontSize: '10px', padding: '0 8px' }}
              onClick={async () => {
                const remaining = await syncOfflineQueue();
                setOfflineQueueCount(remaining);
                if (remaining === 0) await loadAllData();
              }}
            >
              🔄 Sync
            </button>
          )}
          {activeTab === 'home' && (
            <>
              <button className="btn-secondary no-print" style={{ height: '28px', fontSize: '11px', padding: '0 8px' }} onClick={handleExportCSV}>
                📥 CSV
              </button>
              <button className="btn-secondary no-print" style={{ height: '28px', fontSize: '11px', padding: '0 8px' }} onClick={() => setIsReportModalOpen(true)}>
                📄 Report
              </button>
            </>
          )}
          <button className="btn-danger no-print" style={{ height: '28px', fontSize: '11px', padding: '0 8px', backgroundColor: 'rgba(230, 0, 35, 0.08)', color: 'var(--primary)' }} onClick={onLogout}>
            Exit
          </button>
        </div>
      </header>

      {/* Main App Content View based on Active Tab */}
      <div className="mobile-app-content">
        
        {/* Pending Consent Link Requests Banner */}
        {linkRequests.length > 0 && (
          <div style={{ backgroundColor: 'var(--color-warning-bg)', border: '1px solid rgba(126, 35, 139, 0.15)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            <div>
              <strong style={{ color: 'var(--color-warning)', fontSize: '0.8rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🔔 Clinic Connection Request
              </strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--ink)' }}>
                Dr. <strong>{linkRequests[0].physician_email}</strong> requests secure access to your clinical logs.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" style={{ height: '28px', padding: '0 10px', fontSize: '11px' }} onClick={() => handleLinkRespond(linkRequests[0].physician_id, true)}>
                Approve
              </button>
              <button className="btn-secondary" style={{ height: '28px', padding: '0 10px', fontSize: '11px', backgroundColor: 'rgba(0,0,0,0.05)' }} onClick={() => handleLinkRespond(linkRequests[0].physician_id, false)}>
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Home Dashboard */}
        {activeTab === 'home' && (
          <>
            {/* Quick Metrics */}
            <div className="metrics-row" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="glass-panel metric-card" style={{ padding: '12px' }}>
                <span className="metric-label" style={{ fontSize: '10px' }}>Wellness Score</span>
                <span className="metric-value" style={{ fontSize: '20px' }}>{wellnessScore}%</span>
                <span className={`metric-status ${wellnessScore >= 80 ? 'success' : wellnessScore >= 60 ? 'warning' : 'danger'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                  {wellnessScore >= 80 ? 'Controlled' : wellnessScore >= 60 ? 'Moderate' : 'High Risk'}
                </span>
              </div>

              <div className="glass-panel metric-card" style={{ padding: '12px' }}>
                <span className="metric-label" style={{ fontSize: '10px' }}>Logging Streak</span>
                <span className="metric-value" style={{ fontSize: '20px' }}>{streakDays} Days</span>
                <span className="metric-status success" style={{ fontSize: '10px', padding: '2px 6px' }}>Active</span>
              </div>
            </div>

            <div className="metrics-row" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="glass-panel metric-card" style={{ padding: '12px' }}>
                <span className="metric-label" style={{ fontSize: '10px' }}>Glucose</span>
                <span className="metric-value" style={{ fontSize: '18px' }}>{latestGlucose.split(' ')[0]} <span style={{ fontSize: '11px' }}>mg/dL</span></span>
                {lastLog && lastLog.glucose !== null && (
                  <span className={`metric-status ${lastLog.glucose >= (profile?.glucoseFastingTargetMin || 80) && lastLog.glucose <= (profile?.glucoseFastingTargetMax || 130) ? 'success' : 'danger'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                    {lastLog.glucose >= (profile?.glucoseFastingTargetMin || 80) && lastLog.glucose <= (profile?.glucoseFastingTargetMax || 130) ? 'In Range' : 'Out Target'}
                  </span>
                )}
              </div>

              <div className="glass-panel metric-card" style={{ padding: '12px' }}>
                <span className="metric-label" style={{ fontSize: '10px' }}>Blood Pressure</span>
                <span className="metric-value" style={{ fontSize: '18px' }}>{latestBp.split(' ')[0]} <span style={{ fontSize: '11px' }}>mmHg</span></span>
                <span className="metric-status warning" style={{ fontSize: '10px', padding: '2px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{profile?.bpStage || 'Normal'}</span>
              </div>
            </div>

            {/* Clinical Alerts and Predictions */}
            <div className="glass-panel alert-banner-container" style={{ padding: '16px' }}>
              <h3 className="heading-card" style={{ fontSize: '15px' }}>Clinical Risk & Alerts</h3>
              
              {analysis.alerts.length === 0 && analysis.correlations.length === 0 && (
                <p className="text-secondary text-xs" style={{ margin: 0 }}>
                  No immediate clinical risk alerts or abnormal biometric trends forecast for the next 48 hours.
                </p>
              )}

              {analysis.alerts.map((alert, i) => {
                const isCritical = alert.includes('CRITICAL') || alert.includes('🚨');
                return (
                  <div key={`alert-${i}`} className={`alert-banner ${isCritical ? 'danger' : 'warning'}`} style={{ padding: '8px 12px', fontSize: '12px' }}>
                    <div className="alert-banner-title" style={{ fontSize: '13px' }}>{isCritical ? '🚨 Critical Alert' : '⚠️ Warning'}</div>
                    <div>{alert}</div>
                  </div>
                );
              })}

              {analysis.correlations.map((cor, i) => (
                <div key={`cor-${i}`} className="alert-banner" style={{ backgroundColor: 'var(--color-info-bg)', borderColor: 'rgba(59, 130, 246, 0.2)', color: 'var(--text-primary)', padding: '8px 12px', fontSize: '12px' }}>
                  <div className="alert-banner-title" style={{ color: 'var(--color-info)', fontSize: '13px' }}>🔍 Correlation Pattern</div>
                  <div>{cor}</div>
                </div>
              ))}

              {analysis.insights.map((ins, i) => (
                <div key={`ins-${i}`} style={{ fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: '8px', borderLeft: '3px solid var(--primary)', margin: '4px 0' }}>
                  {ins}
                </div>
              ))}
            </div>

            {/* SVG curves */}
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div className="flex-between" style={{ marginBottom: '12px' }}>
                <h3 className="heading-card" style={{ fontSize: '15px', margin: 0 }}>Clinical Curves</h3>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    className={`btn-secondary ${graphMode === 'glucose' ? 'active' : ''}`}
                    onClick={() => setGraphMode('glucose')}
                    style={{ padding: '4px 8px', fontSize: '11px', height: '24px', borderRadius: '12px', borderColor: graphMode === 'glucose' ? 'var(--primary)' : '' }}
                  >
                    Sugar
                  </button>
                  <button 
                    className={`btn-secondary ${graphMode === 'bp' ? 'active' : ''}`}
                    onClick={() => setGraphMode('bp')}
                    style={{ padding: '4px 8px', fontSize: '11px', height: '24px', borderRadius: '12px', borderColor: graphMode === 'bp' ? 'var(--primary)' : '' }}
                  >
                    BP
                  </button>
                </div>
              </div>

              <div className="chart-svg-container" style={{ padding: '16px 8px 4px 8px', height: '160px' }}>
                {points.length < 2 ? (
                  <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)', fontSize: '11px' }}>
                    Need at least 2 logs containing this metric to plot trends.
                  </div>
                ) : (
                  <svg width="100%" height="100%" viewBox="0 0 500 200" style={{ overflow: 'visible' }}>
                    <line x1="50" y1="20" x2="450" y2="20" stroke="var(--border-light)" strokeDasharray="3" />
                    <line x1="50" y1="100" x2="450" y2="100" stroke="var(--border-light)" strokeDasharray="3" />
                    <line x1="50" y1="180" x2="450" y2="180" stroke="var(--border-color)" />

                    {graphMode === 'glucose' ? (
                      <>
                        <line x1="50" y1={180 - ((130 - 40) / 180) * 160} x2="450" y2={180 - ((130 - 40) / 180) * 160} stroke="rgba(245, 158, 11, 0.4)" strokeDasharray="4 2" />
                        <line x1="50" y1={180 - ((70 - 40) / 180) * 160} x2="450" y2={180 - ((70 - 40) / 180) * 160} stroke="rgba(239, 68, 68, 0.4)" strokeDasharray="4 2" />
                      </>
                    ) : (
                      <line x1="50" y1={180 - ((130 - 80) / 100) * 160} x2="450" y2={180 - ((130 - 80) / 100) * 160} stroke="rgba(245, 158, 11, 0.4)" strokeDasharray="4 2" />
                    )}

                    <polyline fill="none" stroke="var(--primary)" strokeWidth="3" points={polylinePoints} />

                    {points.map((p, idx) => (
                      <g key={`pt-${idx}`}>
                        <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-app)" stroke="var(--primary)" strokeWidth="2.5" />
                        <text x={p.x} y={p.y - 10} textAnchor="middle" fill="var(--text-primary)" fontSize="9" fontWeight="bold">
                          {p.rawVal}
                        </text>
                        <text x={p.x} y="195" textAnchor="middle" fill="var(--text-muted)" fontSize="8">
                          {p.date}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            </div>

            {/* Disease reference & breathing coach */}
            <div className="glass-panel" style={{ padding: '16px' }}>
              <h3 className="heading-card" style={{ fontSize: '15px', marginBottom: '8px' }}>📚 Care Guide & Pacer</h3>
              <p className="text-secondary text-xs" style={{ marginBottom: '12px' }}>Guidelines and breathing tools configured for your conditions.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {profile?.conditions?.toLowerCase().includes('anxiety') && (
                  <button 
                    type="button" 
                    className="btn-secondary no-print" 
                    style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px', height: '36px', justifyContent: 'center' }}
                    onClick={() => {
                      setIsBreathingModalOpen(true);
                      setBreathingPhase('idle');
                      setBreathingCountdown(4);
                      setBreathingCycles(0);
                    }}
                  >
                    🧘 Start Vagus Nerve Breathing Pacer
                  </button>
                )}
                
                <div style={{ fontSize: '11px', color: 'var(--mute)', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                  {profile?.conditions?.toLowerCase().includes('diabetes') && (
                    <div>💡 <strong>Diabetes target</strong>: Fasting 80-130 mg/dL. Carry glucose tablets for lows (&lt;70 mg/dL).</div>
                  )}
                  {profile?.conditions?.toLowerCase().includes('hypertension') && (
                    <div>💡 <strong>BP target</strong>: Under 130/80 mmHg. Stage 2 is &gt;=140/90. Rest and re-test if high.</div>
                  )}
                  {profile?.conditions?.toLowerCase().includes('asthma') && (
                    <div>💡 <strong>Asthma target</strong>: PEF &gt; 400 L/min. Use rescue inhaler if Peak Flow drops &lt; 350 L/min.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Tab 2: Timeline Logs */}
        {activeTab === 'logs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 className="heading-card" style={{ fontSize: '16px', margin: 0 }}>Timeline Logs</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {logs.length === 0 ? (
                <div className="glass-panel flex-center" style={{ padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No vital logs recorded yet. Tap the floating + button to enter your first log.
                </div>
              ) : (
                logs.slice().reverse().map((log, idx) => {
                  const isOutOfRange = (log.glucose && (log.glucose < (profile?.glucoseFastingTargetMin || 80) || log.glucose > (profile?.glucoseFastingTargetMax || 130))) || 
                                       (log.bp && (parseInt(log.bp.split('/')[0]) > (profile?.bpSystolicTargetMax || 130)));
                  return (
                    <div className="glass-panel" key={`log-${idx}`} style={{ padding: '12px 16px', borderLeft: `4px solid ${isOutOfRange ? 'var(--color-danger)' : 'var(--color-success)'}` }}>
                      <div className="flex-between" style={{ borderBottom: '1px solid var(--hairline-soft)', paddingBottom: '6px', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{log.date}</strong>
                        <span className="text-xs text-muted" style={{ fontWeight: '600' }}>
                          {log.meal === 'skipped' ? '⚠️ Skipped Breakfast' : log.meal === 'yes' ? 'Breakfast Consumed' : 'N/A'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '12px' }}>
                        {log.glucose !== null && log.glucose !== undefined && (
                          <div>
                            <span className="text-muted">Sugar:</span> <strong>{log.glucose} mg/dL</strong>
                          </div>
                        )}
                        {log.bp && (
                          <div>
                            <span className="text-muted">BP:</span> <strong>{log.bp} mmHg</strong>
                          </div>
                        )}
                        {log.anxietyLevel !== null && log.anxietyLevel !== undefined && (
                          <div>
                            <span className="text-muted">Anxiety:</span> <strong>{log.anxietyLevel}/21</strong>
                          </div>
                        )}
                        {log.heartRate !== null && log.heartRate !== undefined && (
                          <div>
                            <span className="text-muted">HR:</span> <strong>{log.heartRate} bpm</strong>
                          </div>
                        )}
                        {log.peakFlow !== null && log.peakFlow !== undefined && (
                          <div>
                            <span className="text-muted">Peak Flow:</span> <strong>{log.peakFlow} L/m</strong>
                          </div>
                        )}
                        {log.painLevel !== null && log.painLevel !== undefined && (
                          <div>
                            <span className="text-muted">Pain:</span> <strong>{log.painLevel}/10</strong>
                          </div>
                        )}
                      </div>

                      {log.symptoms && log.symptoms !== 'None' && (
                        <div style={{ marginTop: '8px', fontSize: '11px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span className="text-muted">Symptoms:</span>
                          <span className="badge badge-secondary" style={{ padding: '2px 6px', fontSize: '10px' }}>{log.symptoms}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Prescriptions */}
        {activeTab === 'meds' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="flex-between">
              <h3 className="heading-card" style={{ fontSize: '16px', margin: 0 }}>Active Prescriptions</h3>
              <button 
                type="button" 
                className="btn-secondary no-print" 
                style={{ height: '28px', padding: '0 8px', fontSize: '11px', backgroundColor: 'var(--secondary-bg)' }}
                onClick={() => setIsAddingMed(!isAddingMed)}
              >
                {isAddingMed ? 'Cancel' : '+ Add Drug'}
              </button>
            </div>

            {isAddingMed && (
              <form onSubmit={handleAddMed} style={{ backgroundColor: 'var(--surface-card)', padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-color)', textAlign: 'left' }}>
                <div>
                  <label className="input-label" style={{ fontSize: '0.75rem' }}>Medication Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Metformin" 
                    value={newMedName} 
                    onChange={e => setNewMedName(e.target.value)} 
                    required 
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.75rem' }}>Dose</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. 500mg" 
                      value={newMedDose} 
                      onChange={e => setNewMedDose(e.target.value)} 
                      required 
                    />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.75rem' }}>Frequency</label>
                    <select 
                      className="input-field" 
                      value={newMedFreq} 
                      onChange={e => setNewMedFreq(e.target.value)}
                      style={{ background: 'var(--canvas)' }}
                    >
                      <option value="Once daily">Once daily</option>
                      <option value="Twice daily">Twice daily</option>
                      <option value="As needed (PRN)">As needed</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '36px' }}>
                  Save Prescription
                </button>
              </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {meds.length === 0 ? (
                <div className="glass-panel flex-center" style={{ padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No active prescriptions logged. Tap + Add Drug to build your compliance list.
                </div>
              ) : (
                meds.map(med => (
                  <div className={`med-item ${med.taken ? 'taken' : ''}`} key={med.id} onClick={() => handleToggleMed(med.id)} style={{ padding: '12px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: med.taken ? 'rgba(46, 125, 50, 0.05)' : 'var(--canvas)', border: '1px solid var(--hairline-soft)' }}>
                    <div className="med-item-info" style={{ textAlign: 'left' }}>
                      <strong style={{ fontSize: '0.95rem' }}>{med.name} {med.dose}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--mute)', marginTop: '2px' }}>{med.frequency}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button 
                        type="button" 
                        className="no-print"
                        onClick={(e) => handleDeleteMed(e, med.id, med.name)} 
                        style={{ background: 'none', border: 'none', color: 'var(--stone)', cursor: 'pointer', padding: '6px', fontSize: '0.95rem' }}
                      >
                        🗑️
                      </button>
                      <div className={`checkbox-custom ${med.taken ? 'checked' : ''}`} style={{ width: '20px', height: '20px', borderRadius: '5px' }}>
                        {med.taken && '✓'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Clinical AI Chat */}
        {activeTab === 'chat' && (
          <div className="chat-companion-card" style={{ height: '76vh', border: 'none', padding: 0 }}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span className="text-xs text-muted" style={{ fontWeight: '600' }}>Validated HIPAA self-management coach</span>
              <button 
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                onClick={() => setIsPromptLabOpen(true)}
              >
                💡 Prompt Lab
              </button>
            </div>

            <div className="chat-messages-container" style={{ padding: '8px 0' }}>
              {chatMessages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', color: 'var(--mute)', gap: '12px' }}>
                  <span style={{ fontSize: '2.5rem' }}>🤖</span>
                  <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Ask Clinical AI Companion</div>
                  <div style={{ fontSize: '11px', maxWidth: '250px', lineHeight: '1.4' }}>Consult evidence-based GINA/ADA medical guidelines or analyze biometric correlations.</div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div className={`chat-message ${msg.sender}`} key={`msg-${i}`} style={{ padding: '10px 14px', borderRadius: '12px', fontSize: '13px', maxWidth: '85%' }}>
                  {msg.category && (
                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 'bold', color: msg.sender === 'user' ? '#fff' : 'var(--primary)', marginBottom: '2px' }}>
                      {msg.category}
                    </span>
                  )}
                  <div style={{ whiteSpace: 'pre-line', textAlign: 'left' }}>{msg.text}</div>
                  <span style={{ display: 'block', fontSize: '0.6rem', textAlign: 'right', marginTop: '4px', opacity: 0.65 }}>
                    {msg.timestamp}
                  </span>
                </div>
              ))}
              <div ref={chatMessagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-bar">
              <input 
                type="text" 
                className="input-field" 
                placeholder="Ask about symptoms, patterns..." 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                style={{ height: '38px', fontSize: '14px', borderRadius: '12px' }}
              />
              <button type="submit" className="btn-primary" style={{ height: '38px', padding: '0 12px', fontSize: '13px' }}>
                Send
              </button>
            </form>
          </div>
        )}

        {/* Tab 5: Profile & Care Thresholds */}
        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="heading-card" style={{ fontSize: '16px', margin: 0 }}>Profile & Thresholds</h3>
            
            {/* Target Tuning Card */}
            <div className="glass-panel" style={{ padding: '16px', textAlign: 'left' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Target Tuning</h4>
              {!isTuningOpen ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                    <div style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: '12px' }}>
                      <span className="text-muted" style={{ display: 'block', fontSize: '10px' }}>Glucose target</span>
                      <strong>{profile?.glucoseFastingTargetMin} - {profile?.glucoseFastingTargetMax} mg/dL</strong>
                    </div>
                    <div style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: '12px' }}>
                      <span className="text-muted" style={{ display: 'block', fontSize: '10px' }}>BP limits</span>
                      <strong>{profile?.bpSystolicTargetMax}/{profile?.bpDiastolicTargetMax} mmHg</strong>
                    </div>
                  </div>
                  <button className="btn-secondary" style={{ height: '32px', width: '100%', justifyContent: 'center', fontSize: '12px', marginTop: '6px' }} onClick={() => setIsTuningOpen(true)}>
                    ⚙️ Tune Limits
                  </button>
                </div>
              ) : (
                <form onSubmit={handleUpdateThresholds} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label className="input-label" style={{ fontSize: '0.65rem' }}>Glucose Min</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        style={{ padding: '6px', fontSize: '13px', height: '32px' }}
                        value={tuningGlucoseMin} 
                        onChange={e => setTuningGlucoseMin(e.target.value)} 
                        required 
                      />
                    </div>
                    <div>
                      <label className="input-label" style={{ fontSize: '0.65rem' }}>Glucose Max</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        style={{ padding: '6px', fontSize: '13px', height: '32px' }}
                        value={tuningGlucoseMax} 
                        onChange={e => setTuningGlucoseMax(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label className="input-label" style={{ fontSize: '0.65rem' }}>Systolic Max</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        style={{ padding: '6px', fontSize: '13px', height: '32px' }}
                        value={tuningBpSysMax} 
                        onChange={e => setTuningBpSysMax(e.target.value)} 
                        required 
                      />
                    </div>
                    <div>
                      <label className="input-label" style={{ fontSize: '0.65rem' }}>Diastolic Max</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        style={{ padding: '6px', fontSize: '13px', height: '32px' }}
                        value={tuningBpDiaMax} 
                        onChange={e => setTuningBpDiaMax(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center', height: '32px', fontSize: '12px' }}>Save</button>
                    <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center', height: '32px', fontSize: '12px' }} onClick={() => setIsTuningOpen(false)}>Cancel</button>
                  </div>
                </form>
              )}
            </div>

            {/* Adherence alerts switch */}
            <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontWeight: 'bold', fontSize: '13px', display: 'block' }}>Adherence Alerts</span>
                <span className="text-muted text-xs" style={{ display: 'block' }}>Daily logging notifications</span>
              </div>
              <button 
                type="button"
                className={`btn-secondary ${isNotificationEnabled ? 'btn-primary' : ''}`}
                style={{ height: '32px', padding: '0 10px', fontSize: '11px', backgroundColor: isNotificationEnabled ? 'var(--primary)' : 'var(--secondary-bg)', color: isNotificationEnabled ? '#fff' : 'var(--ink)' }}
                onClick={handleToggleReminders}
              >
                {isNotificationEnabled ? '🔔 Active' : '🔕 Off'}
              </button>
            </div>

            {/* Physician details */}
            <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Clinic & Physician</h4>
              <div>
                <strong style={{ color: 'var(--text-primary)', fontSize: '13px', display: 'block' }}>{profile?.physicianName || 'Dr. Ramirez'}</strong>
                <span className="text-muted text-xs">{profile?.physicianClinic || 'Oakridge Medical'}</span>
              </div>
              <a href={`tel:${profile?.physicianPhone || '555-0147'}`} className="btn-secondary" style={{ justifyContent: 'center', fontSize: '12px', height: '32px' }}>
                📞 Call Clinic ({profile?.physicianPhone || '555-0147'})
              </a>
            </div>

            {/* Inject Scenario Settings directly in Profile tab */}
            <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Demo Scenario Presets</h4>
              <p className="text-muted text-xs" style={{ margin: 0, marginBottom: '8px' }}>Inject mock vitals history into the database:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8rem', padding: '8px 12px', height: 'auto' }} 
                  onClick={async () => {
                    await seedDemoScenario('stable');
                    await loadAllData();
                    alert('Stable Diabetes & Hypertension data seeded!');
                  }}
                >
                  🟢 Stable Diabetes & BP
                </button>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8rem', padding: '8px 12px', height: 'auto' }} 
                  onClick={async () => {
                    await seedDemoScenario('hypertension_risk');
                    await loadAllData();
                    alert('Hypertension slope crisis data seeded!');
                  }}
                >
                  🔴 Hypertension Slope Crisis
                </button>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8rem', padding: '8px 12px', height: 'auto' }} 
                  onClick={async () => {
                    await seedDemoScenario('anxiety_vagal');
                    await loadAllData();
                    alert('Anxiety Vagal HR coupling data seeded!');
                  }}
                >
                  🟣 Anxiety Vagal HR Coupling
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) (visible on Home, Logs, and Meds tabs) */}
      {(activeTab === 'home' || activeTab === 'logs' || activeTab === 'meds') && (
        <button 
          type="button" 
          className="fab no-print" 
          onClick={() => setIsQuickLogOpen(true)}
          title="Enter New Log"
        >
          +
        </button>
      )}

      {/* Bottom Navigation Tabs */}
      <nav className="bottom-nav no-print">
        <button type="button" className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
          <span className="nav-tab-icon">🏠</span>
          <span className="nav-tab-label">Home</span>
        </button>
        <button type="button" className={`nav-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
          <span className="nav-tab-icon">📋</span>
          <span className="nav-tab-label">Logs</span>
        </button>
        <button type="button" className={`nav-tab ${activeTab === 'meds' ? 'active' : ''}`} onClick={() => setActiveTab('meds')}>
          <span className="nav-tab-icon">💊</span>
          <span className="nav-tab-label">Meds</span>
        </button>
        <button type="button" className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          <span className="nav-tab-icon">💬</span>
          <span className="nav-tab-label">Chat</span>
        </button>
        <button type="button" className={`nav-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          <span className="nav-tab-icon">👤</span>
          <span className="nav-tab-label">Profile</span>
        </button>
      </nav>

      {/* Slider-based Quick Log Bottom Sheet */}
      {isQuickLogOpen && (
        <div className="bottom-sheet-backdrop no-print" onClick={() => setIsQuickLogOpen(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h3 className="heading-card" style={{ fontSize: '16px', margin: 0 }}>Quick Biometric Entry</h3>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ height: '28px', padding: '0 8px', fontSize: '11px', backgroundColor: 'var(--secondary-bg)' }}
                onClick={() => setIsBtModalOpen(true)}
              >
                🔌 Sync BLE
              </button>
            </div>
            
            <form onSubmit={(e) => { handleQuickLog(e); setIsQuickLogOpen(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {profile?.conditions?.toLowerCase().includes('diabetes') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="input-label" htmlFor="quick-glucose" style={{ fontSize: '0.75rem' }}>Glucose (mg/dL)</label>
                    <input 
                      id="quick-glucose"
                      type="number" 
                      className="input-field" 
                      placeholder="e.g. 115"
                      value={logGlucose}
                      onChange={e => setLogGlucose(e.target.value)}
                      style={{ height: '36px', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="quick-meal" className="input-label" style={{ fontSize: '0.75rem' }}>Breakfast:</label>
                    <select 
                      id="quick-meal"
                      className="input-field" 
                      value={logMeal}
                      onChange={e => setLogMeal(e.target.value)}
                      style={{ height: '36px', fontSize: '14px', background: 'var(--canvas)' }}
                    >
                      <option value="yes">Consumed</option>
                      <option value="skipped">Skipped</option>
                    </select>
                  </div>
                </div>
              )}

              {(profile?.conditions?.toLowerCase().includes('hypertension') || profile?.conditions?.toLowerCase().includes('anxiety')) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="input-label" htmlFor="quick-sys" style={{ fontSize: '0.75rem' }}>Systolic BP (mmHg)</label>
                    <input 
                      id="quick-sys"
                      type="number" 
                      className="input-field" 
                      placeholder="120"
                      value={logBpSys}
                      onChange={e => setLogBpSys(e.target.value)}
                      style={{ height: '36px', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label className="input-label" htmlFor="quick-dia" style={{ fontSize: '0.75rem' }}>Diastolic BP (mmHg)</label>
                    <input 
                      id="quick-dia"
                      type="number" 
                      className="input-field" 
                      placeholder="80"
                      value={logBpDia}
                      onChange={e => setLogBpDia(e.target.value)}
                      style={{ height: '36px', fontSize: '14px' }}
                    />
                  </div>
                </div>
              )}

              {profile?.conditions?.toLowerCase().includes('anxiety') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="input-label" htmlFor="quick-anxiety" style={{ fontSize: '0.75rem' }}>Anxiety (GAD-7 0–21)</label>
                    <input 
                      id="quick-anxiety"
                      type="range" 
                      min="0"
                      max="21"
                      value={logAnxiety}
                      onChange={e => setLogAnxiety(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--primary)', textAlign: 'right' }}>
                      Score: {logAnxiety}
                    </div>
                  </div>
                  <div>
                    <label className="input-label" htmlFor="quick-hr" style={{ fontSize: '0.75rem' }}>Heart Rate (bpm)</label>
                    <input 
                      id="quick-hr"
                      type="number" 
                      className="input-field" 
                      placeholder="e.g. 72"
                      value={logHeartRate}
                      onChange={e => setLogHeartRate(e.target.value)}
                      style={{ height: '36px', fontSize: '14px' }}
                    />
                  </div>
                </div>
              )}

              {profile?.conditions?.toLowerCase().includes('asthma') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="input-label" htmlFor="quick-pf" style={{ fontSize: '0.75rem' }}>Peak Flow (L/min)</label>
                    <input 
                      id="quick-pf"
                      type="number" 
                      className="input-field" 
                      placeholder="e.g. 500"
                      value={logPeakFlow}
                      onChange={e => setLogPeakFlow(e.target.value)}
                      style={{ height: '36px', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label className="input-label" htmlFor="quick-puffs" style={{ fontSize: '0.75rem' }}>Rescue Inhaler Puffs</label>
                    <input 
                      id="quick-puffs"
                      type="number" 
                      className="input-field" 
                      placeholder="e.g. 0"
                      value={logInhalerPuffs}
                      onChange={e => setLogInhalerPuffs(e.target.value)}
                      style={{ height: '36px', fontSize: '14px' }}
                    />
                  </div>
                </div>
              )}

              {profile?.conditions?.toLowerCase().includes('pain') && (
                <div>
                  <label className="input-label" htmlFor="quick-pain" style={{ fontSize: '0.75rem' }}>Pain Intensity (NRS 0–10)</label>
                  <input 
                    id="quick-pain"
                    type="range" 
                    min="0"
                    max="10"
                    value={logPain}
                    onChange={e => setLogPain(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--primary)', textAlign: 'right' }}>
                    Pain: {logPain}/10
                  </div>
                </div>
              )}

              <div>
                <label className="input-label" htmlFor="quick-symptoms" style={{ fontSize: '0.75rem' }}>Symptoms Logged</label>
                <input 
                  id="quick-symptoms"
                  type="text" 
                  className="input-field" 
                  placeholder="Headache, dizzy, none..."
                  value={logSymptoms}
                  onChange={e => setLogSymptoms(e.target.value)}
                  style={{ height: '36px', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setIsQuickLogOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  Log Vitals
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prompts, breathing pacer modal, clinician report remain identically structured but nested within outer overlay rendering logic */}
      <PromptLab 
        isOpen={isPromptLabOpen} 
        onClose={() => setIsPromptLabOpen(false)} 
        onSelectPrompt={(p) => { processCompanionQuery(p); setActiveTab('chat'); }} 
      />

      {isBtModalOpen && (
        <div className="modal-backdrop" onClick={() => btSyncState !== 'syncing' && setIsBtModalOpen(false)}>
          <div className="modal-content-card" style={{ padding: '20px' }} onClick={e => e.stopPropagation()}>
            {btSyncState === 'idle' && (
              <>
                <h3 className="font-serif" style={{ fontSize: '1.1rem', marginBottom: '8px', textAlign: 'center' }}>Bluetooth Sync</h3>
                <p className="text-muted text-xs" style={{ marginBottom: '16px', textAlign: 'center' }}>
                  Select a clinical Bluetooth device to pull live vitals telemetry:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', height: 'auto' }}
                    onClick={() => runHighFidelitySimulatedSync({ type: 'glucometer', name: 'Accu-Chek Instant Glucometer' })}
                  >
                    <span style={{ fontSize: '1.2rem' }}>🩸</span>
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ display: 'block', fontSize: '0.85rem' }}>Accu-Chek Instant</strong>
                      <span className="text-muted" style={{ fontSize: '10px' }}>Blood sugar sensor</span>
                    </div>
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', height: 'auto' }}
                    onClick={() => runHighFidelitySimulatedSync({ type: 'bp_cuff', name: 'Omron Evolv Wireless Cuff' })}
                  >
                    <span style={{ fontSize: '1.2rem' }}>🩺</span>
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ display: 'block', fontSize: '0.85rem' }}>Omron Evolv Cuff</strong>
                      <span className="text-muted" style={{ fontSize: '10px' }}>Blood pressure transmitter</span>
                    </div>
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', height: 'auto' }}
                    onClick={() => runHighFidelitySimulatedSync({ type: 'heart_rate', name: 'Polar H10 Heart Strap' })}
                  >
                    <span style={{ fontSize: '1.2rem' }}>💓</span>
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ display: 'block', fontSize: '0.85rem' }}>Polar H10 Strap</strong>
                      <span className="text-muted" style={{ fontSize: '10px' }}>Heart rate sensor</span>
                    </div>
                  </button>
                </div>
              </>
            )}

            {btSyncState === 'searching' && (
              <div style={{ padding: '12px 0', textAlign: 'center' }}>
                <div style={{ margin: '0 auto 12px auto', width: '36px', height: '36px', borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                <h4 className="font-serif" style={{ fontSize: '1rem', marginBottom: '4px' }}>Scanning...</h4>
                <p className="text-muted" style={{ fontSize: '10px' }}>Searching for {btSyncDeviceName}</p>
              </div>
            )}

            {btSyncState === 'found' && (
              <div style={{ padding: '12px 0', textAlign: 'center' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px' }}>📶</span>
                <h4 className="font-serif" style={{ fontSize: '1rem', marginBottom: '4px', color: 'var(--color-success)' }}>
                  Found Device
                </h4>
                <p className="text-muted" style={{ fontSize: '11px', fontWeight: '500' }}>{btSyncDeviceName}</p>
                <p className="text-muted" style={{ fontSize: '10px', marginTop: '2px' }}>Connecting...</p>
              </div>
            )}

            {btSyncState === 'syncing' && (
              <div style={{ padding: '12px 0', textAlign: 'center' }}>
                <div style={{ margin: '0 auto 12px auto', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', animation: 'ping 1.5s ease-in-out infinite' }}>
                  <span style={{ fontSize: '1.1rem' }}>📥</span>
                </div>
                <h4 className="font-serif" style={{ fontSize: '1rem', marginBottom: '4px' }}>Syncing data...</h4>
                <div style={{ margin: '8px auto', padding: '6px', backgroundColor: 'var(--secondary-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', width: 'fit-content' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--primary)' }}>
                    {liveBtReading || '---'}
                  </span>
                </div>
              </div>
            )}

            {btSyncState === 'done' && (
              <div style={{ padding: '12px 0', textAlign: 'center' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>✅</span>
                <h4 className="font-serif" style={{ fontSize: '1rem', marginBottom: '4px', color: 'var(--color-success)' }}>Sync Complete</h4>
                <p className="text-muted" style={{ fontSize: '11px' }}>Vitals successfully synced to form!</p>
              </div>
            )}

            <button 
              type="button" 
              className="btn-secondary" 
              style={{ marginTop: '16px', width: '100%', justifyContent: 'center', height: '32px' }}
              onClick={() => setIsBtModalOpen(false)}
              disabled={btSyncState === 'syncing'}
            >
              {btSyncState === 'done' ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {isBreathingModalOpen && (
        <div className="modal-backdrop" onClick={() => breathingPhase !== 'inhale' && breathingPhase !== 'hold' && breathingPhase !== 'exhale' && setIsBreathingModalOpen(false)}>
          <div className="modal-content-card" style={{ maxWidth: '360px', padding: '20px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-serif" style={{ fontSize: '1.15rem', marginBottom: '4px' }}>Paced Breathing Coach</h3>
            <p className="text-muted" style={{ fontSize: '10px', marginBottom: '12px' }}>
              Perform 4-4-6 paced breathing to lower resting heart rate.
            </p>
            
            <div className="breathing-circle-wrapper" style={{ height: '180px', margin: '12px 0' }}>
              <div className="breathing-circle-container" style={{ width: '140px', height: '140px' }}>
                <div className={`breathing-circle-outer ${breathingPhase}`} />
                <div className={`breathing-circle-inner ${breathingPhase}`} style={{ width: '70px', height: '70px' }}>
                  <strong style={{ fontSize: '0.95rem' }}>
                    {breathingPhase === 'idle' && 'Ready'}
                    {breathingPhase === 'inhale' && 'Inhale'}
                    {breathingPhase === 'hold' && 'Hold'}
                    {breathingPhase === 'exhale' && 'Exhale'}
                    {breathingPhase === 'completed' && 'Done!'}
                  </strong>
                  <span style={{ fontSize: '0.75rem', marginTop: '1px' }}>
                    {breathingPhase !== 'idle' && breathingPhase !== 'completed' && `${breathingCountdown}s`}
                  </span>
                </div>
              </div>
            </div>

            {breathingPhase !== 'idle' && breathingPhase !== 'completed' && (
              <div style={{ marginBottom: '12px', fontSize: '11px' }}>
                <span className="text-muted">Cycle <strong>{breathingCycles + 1}</strong> of 4</span>
                <div style={{ width: '80px', height: '3px', backgroundColor: 'var(--border-light)', borderRadius: '2px', margin: '6px auto 0 auto', overflow: 'hidden' }}>
                  <div style={{ width: `${(breathingCycles / 4) * 100}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )}

            {breathingPhase === 'idle' && (
              <button 
                type="button" 
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', height: '36px' }}
                onClick={startBreathing}
              >
                🧘 Start Exercise
              </button>
            )}

            {breathingPhase === 'completed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ color: 'var(--color-success)', fontWeight: '600', fontSize: '11px', marginBottom: '4px' }}>
                  Completed 4 cycles of paced breathing!
                </div>
                <button 
                  type="button" 
                  className="btn-primary" 
                  style={{ width: '100%', justifyContent: 'center', height: '36px', fontSize: '11px' }}
                  onClick={() => {
                    setLogHeartRate('68');
                    setIsBreathingModalOpen(false);
                    // Open Quick Log Bottom Sheet and focus heart rate field
                    setIsQuickLogOpen(true);
                  }}
                >
                  💓 Sync Post-Breathing HR (68 bpm)
                </button>
              </div>
            )}

            {(breathingPhase === 'inhale' || breathingPhase === 'hold' || breathingPhase === 'exhale') && (
              <button 
                type="button" 
                className="btn-danger" 
                style={{ width: '100%', justifyContent: 'center', height: '36px' }}
                onClick={stopBreathing}
              >
                Stop Exercise
              </button>
            )}

            {breathingPhase !== 'inhale' && breathingPhase !== 'hold' && breathingPhase !== 'exhale' && (
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ marginTop: '8px', width: '100%', justifyContent: 'center', height: '32px' }}
                onClick={() => setIsBreathingModalOpen(false)}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {isReportModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsReportModalOpen(false)}>
          <div className="modal-content-card clinician-report-modal" style={{ maxWidth: '800px', width: '95%', textAlign: 'left', padding: '16px' }} onClick={e => e.stopPropagation()}>
            <div className="flex-between no-print" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
              <h3 className="font-serif" style={{ fontSize: '1.15rem' }}>📄 Clinician Report</h3>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" className="btn-primary" style={{ height: '32px', padding: '0 12px', fontSize: '12px' }} onClick={() => window.print()}>
                  🖨️ Print / Save PDF
                </button>
                <button type="button" className="btn-secondary" style={{ height: '32px', padding: '0 12px', fontSize: '12px' }} onClick={() => setIsReportModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            <div className="printable-report-container" style={{ color: '#000', backgroundColor: '#fff', padding: '8px' }}>
              <div style={{ borderBottom: '2px solid #333', paddingBottom: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '0 0 2px 0', color: '#111' }}>CHRONICCARE COMPANION</h1>
                  <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: '600', textTransform: 'uppercase' }}>Clinical Vitals Summary Report</span>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.75rem' }}>
                  <strong>Report Date:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', fontSize: '0.8rem' }}>
                <div style={{ border: '1px solid #ddd', padding: '8px', borderRadius: '6px' }}>
                  <h4 style={{ margin: '0 0 6px 0', borderBottom: '1px solid #eee', paddingBottom: '2px', fontWeight: 'bold' }}>Patient Details</h4>
                  <div><strong>Name:</strong> {profile?.name || 'Jane Doe'}</div>
                  <div><strong>Diagnoses:</strong> {profile?.conditions || 'Not configured'}</div>
                  <div><strong>Logging Streak:</strong> {streakDays} days</div>
                </div>
                <div style={{ border: '1px solid #ddd', padding: '8px', borderRadius: '6px' }}>
                  <h4 style={{ margin: '0 0 6px 0', borderBottom: '1px solid #eee', paddingBottom: '2px', fontWeight: 'bold' }}>Clinic & Physician</h4>
                  <div><strong>Physician:</strong> {profile?.physicianName || 'Dr. Ramirez'}</div>
                  <div><strong>Clinic:</strong> {profile?.physicianClinic || 'Oakridge Medical'}</div>
                  <div><strong>Phone:</strong> {profile?.physicianPhone || '555-0147'}</div>
                </div>
              </div>

              <h4 style={{ margin: '16px 0 6px 0', fontWeight: 'bold', fontSize: '0.9rem', borderBottom: '1px solid #333', paddingBottom: '2px' }}>7-Day Biometrics & Vitals Summary</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                    <th style={{ textAlign: 'left', padding: '6px', border: '1px solid #ddd' }}>Biometric Parameter</th>
                    <th style={{ textAlign: 'center', padding: '6px', border: '1px solid #ddd' }}>Clinical Target Range</th>
                    <th style={{ textAlign: 'center', padding: '6px', border: '1px solid #ddd' }}>Min (7d)</th>
                    <th style={{ textAlign: 'center', padding: '6px', border: '1px solid #ddd' }}>Max (7d)</th>
                    <th style={{ textAlign: 'center', padding: '6px', border: '1px solid #ddd' }}>Avg (7d)</th>
                    <th style={{ textAlign: 'center', padding: '6px', border: '1px solid #ddd' }}>Trend Slope</th>
                    <th style={{ textAlign: 'center', padding: '6px', border: '1px solid #ddd' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const stats = getVitalsSummaryStats();
                    if (!stats) {
                      return (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '8px', color: '#666' }}>No biometric log history recorded.</td>
                        </tr>
                      );
                    }
                    
                    const rows = [];
                    if (profile?.conditions?.toLowerCase().includes('diabetes')) {
                      const avg = stats.glucose.count > 0 ? Math.round(stats.glucose.sum / stats.glucose.count) : null;
                      const isAlert = avg !== null && (avg < profile?.glucoseFastingTargetMin || avg > profile?.glucoseFastingTargetMax);
                      rows.push({
                        name: 'Fasting Blood Glucose',
                        target: `${profile?.glucoseFastingTargetMin} - ${profile?.glucoseFastingTargetMax} mg/dL`,
                        min: stats.glucose.count > 0 ? `${stats.glucose.min} mg/dL` : 'N/A',
                        max: stats.glucose.count > 0 ? `${stats.glucose.max} mg/dL` : 'N/A',
                        avg: avg ? `${avg} mg/dL` : 'N/A',
                        trend: getTrendDirection('glucose'),
                        status: isAlert ? '⚠️ Out of Target' : '✅ Controlled'
                      });
                    }
                    if (profile?.conditions?.toLowerCase().includes('hypertension') || profile?.conditions?.toLowerCase().includes('anxiety')) {
                      const avgSys = stats.sys.count > 0 ? Math.round(stats.sys.sum / stats.sys.count) : null;
                      const avgDia = stats.dia.count > 0 ? Math.round(stats.dia.sum / stats.dia.count) : null;
                      const isAlert = avgSys !== null && (avgSys > profile?.bpSystolicTargetMax || avgDia > profile?.bpDiastolicTargetMax);
                      rows.push({
                        name: 'Blood Pressure (BP)',
                        target: `< ${profile?.bpSystolicTargetMax}/${profile?.bpDiastolicTargetMax} mmHg`,
                        min: stats.sys.count > 0 ? `${stats.sys.min}/${stats.dia.min}` : 'N/A',
                        max: stats.sys.count > 0 ? `${stats.sys.max}/${stats.dia.max}` : 'N/A',
                        avg: avgSys ? `${avgSys}/${avgDia}` : 'N/A',
                        trend: getTrendDirection('bp'),
                        status: isAlert ? '⚠️ Elevated BP' : '✅ Controlled'
                      });
                    }
                    if (profile?.conditions?.toLowerCase().includes('anxiety')) {
                      const avgAnx = stats.anxiety.count > 0 ? Math.round(stats.anxiety.sum / stats.anxiety.count) : null;
                      const isAlert = avgAnx !== null && avgAnx >= 10;
                      rows.push({
                        name: 'Anxiety Scale GAD-7',
                        target: '< 10',
                        min: stats.anxiety.count > 0 ? `${stats.anxiety.min}/21` : 'N/A',
                        max: stats.anxiety.count > 0 ? `${stats.anxiety.max}/21` : 'N/A',
                        avg: avgAnx ? `${avgAnx}/21` : 'N/A',
                        trend: getTrendDirection('anxiety'),
                        status: isAlert ? '⚠️ Elevated Anxiety' : '✅ Controlled'
                      });
                    }
                    if (profile?.conditions?.toLowerCase().includes('asthma')) {
                      const avgPF = stats.pf.count > 0 ? Math.round(stats.pf.sum / stats.pf.count) : null;
                      const isAlert = avgPF !== null && avgPF < 350;
                      rows.push({
                        name: 'Peak Flow (PEF)',
                        target: '> 350 L/min',
                        min: stats.pf.count > 0 ? `${stats.pf.min} L/min` : 'N/A',
                        max: stats.pf.count > 0 ? `${stats.pf.max} L/min` : 'N/A',
                        avg: avgPF ? `${avgPF} L/min` : 'N/A',
                        trend: getTrendDirection('pf'),
                        status: isAlert ? '⚠️ Airway Restriction' : '✅ Controlled'
                      });
                    }
                    if (profile?.conditions?.toLowerCase().includes('pain')) {
                      const avgPain = stats.pain.count > 0 ? Math.round(stats.pain.sum / stats.pain.count) : null;
                      const isAlert = avgPain !== null && avgPain >= 6;
                      rows.push({
                        name: 'Pain Intensity (NRS)',
                        target: '< 4',
                        min: stats.pain.count > 0 ? `${stats.pain.min}/10` : 'N/A',
                        max: stats.pain.count > 0 ? `${stats.pain.max}/10` : 'N/A',
                        avg: avgPain ? `${avgPain}/10` : 'N/A',
                        trend: getTrendDirection('pain'),
                        status: isAlert ? '⚠️ Severe Pain' : '✅ Managed'
                      });
                    }

                    return rows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '6px', border: '1px solid #ddd', fontWeight: 'bold' }}>{r.name}</td>
                        <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center', color: '#555' }}>{r.target}</td>
                        <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>{r.min}</td>
                        <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>{r.max}</td>
                        <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center', fontWeight: '600' }}>{r.avg}</td>
                        <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>{r.trend}</td>
                        <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center', fontWeight: '600', color: r.status.includes('✅') ? '#2e7d32' : '#c62828' }}>{r.status}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', fontSize: '0.8rem' }}>
                <div style={{ border: '1px solid #ddd', padding: '8px', borderRadius: '6px' }}>
                  <h4 style={{ margin: '0 0 6px 0', borderBottom: '1px solid #eee', paddingBottom: '2px', fontWeight: 'bold' }}>Clinical Correlations & Warnings</h4>
                  {analysis.alerts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                      {analysis.alerts.map((a, i) => (
                        <div key={i} style={{ color: '#c62828', fontWeight: '500' }}>⚠️ 48h Forecast: {a}</div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#2e7d32', fontWeight: '500', marginBottom: '8px' }}>✅ No immediate critical 48-hour forecast alerts.</div>
                  )}
                  <div style={{ borderLeft: '3px solid #7e238b', paddingLeft: '6px', marginTop: '6px', fontStyle: 'italic', color: '#333' }}>
                    <strong>Anxiety coupling:</strong> {getAnxietyHRCorrelation()}
                  </div>
                </div>

                <div style={{ border: '1px solid #ddd', padding: '8px', borderRadius: '6px' }}>
                  <h4 style={{ margin: '0 0 6px 0', borderBottom: '1px solid #eee', paddingBottom: '2px', fontWeight: 'bold' }}>Medication Adherence</h4>
                  {meds.length === 0 ? (
                    <div style={{ color: '#666' }}>No active prescriptions.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {meds.map(m => (
                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{m.name} ({m.dose})</span>
                          <span style={{ color: m.taken ? '#2e7d32' : '#c62828', fontWeight: '600' }}>
                            {m.taken ? '✓ Taken' : '✗ Missed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginTop: '24px' }}>
                <div style={{ width: '45%', borderTop: '1px solid #333', paddingTop: '4px', textAlign: 'center' }}>
                  Patient Signature & Date
                </div>
                <div style={{ width: '45%', borderTop: '1px solid #333', paddingTop: '4px', textAlign: 'center' }}>
                  Clinician Signature & Credentials
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
