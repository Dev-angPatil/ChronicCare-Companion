/* ----------------------------------------------------
   EXPRESS SERVER ENTRY POINT & REST API (server/index.js)
   ---------------------------------------------------- */

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import { runQuery, getRow, getAllRows } from './db.js';
import { computeWellnessScore, calculateStreak, analyzeTrends } from './analysis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'CHRONIC_CARE_SECRET_2026_KEY';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;

app.use(cors());
app.use(express.json());

// Middleware: Authenticate JWT Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token missing.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  });
}

// Middleware: Verify role is physician
function requirePhysician(req, res, next) {
  if (req.userRole !== 'physician') {
    return res.status(403).json({ error: 'Access denied: Physician credentials required.' });
  }
  next();
}

// ----------------------------------------------------
// 1. AUTHENTICATION ROUTING
// ----------------------------------------------------

app.post('/api/auth/register', async (req, res) => {
  const { email, password, role } = req.body;
  const userRole = role === 'physician' ? 'physician' : 'patient';

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  try {
    const existing = await getRow('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Email address already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await runQuery(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, passwordHash, userRole]
    );

    const token = jwt.sign({ userId: result.id, role: userRole }, JWT_SECRET, { expiresIn: '7d' });

    await runQuery(
      'INSERT INTO activity_logs (user_id, action_type, description, timestamp) VALUES (?, ?, ?, ?)',
      [result.id, 'auth_register', `Registered account: ${email} (${userRole})`, new Date().toISOString()]
    );

    res.status(201).json({
      token,
      user: { id: result.id, email, role: userRole }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server registration failure.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  try {
    const user = await getRow('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    await runQuery(
      'INSERT INTO activity_logs (user_id, action_type, description, timestamp) VALUES (?, ?, ?, ?)',
      [user.id, 'auth_login', `Logged in: ${email}`, new Date().toISOString()]
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server login failure.' });
  }
});

// ----------------------------------------------------
// 2. PATIENT PROFILE ENDPOINTS
// ----------------------------------------------------

app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await getRow('SELECT * FROM profiles WHERE user_id = ?', [req.userId]);
    res.json({ profile: profile || null });
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

app.post('/api/profile', authenticateToken, async (req, res) => {
  const p = req.body;
  try {
    await runQuery(`
      INSERT INTO profiles (
        user_id, name, conditions, physician_name, physician_phone, physician_clinic,
        glucose_min, glucose_max, bp_sys_max, bp_dia_max, bp_stage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        name = excluded.name,
        conditions = excluded.conditions,
        physician_name = excluded.physician_name,
        physician_phone = excluded.physician_phone,
        physician_clinic = excluded.physician_clinic,
        glucose_min = excluded.glucose_min,
        glucose_max = excluded.glucose_max,
        bp_sys_max = excluded.bp_sys_max,
        bp_dia_max = excluded.bp_dia_max,
        bp_stage = excluded.bp_stage
    `, [
      req.userId, p.name, p.conditions, p.physicianName, p.physicianPhone, p.physicianClinic,
      p.glucoseFastingTargetMin ?? 80, p.glucoseFastingTargetMax ?? 130,
      p.bpSystolicTargetMax ?? 130, p.bpDiastolicTargetMax ?? 80, p.bpStage ?? 'Normal'
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('Save profile error:', err);
    res.status(500).json({ error: 'Failed to save profile details.' });
  }
});

// ----------------------------------------------------
// 3. DAILY BIOMETRIC LOGS ENDPOINTS
// ----------------------------------------------------

app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const logs = await getAllRows('SELECT * FROM logs WHERE user_id = ? ORDER BY date ASC', [req.userId]);
    const formatted = logs.map(l => ({
      date: l.date,
      glucose: l.glucose,
      bp: (l.bp_systolic && l.bp_diastolic) ? `${l.bp_systolic}/${l.bp_diastolic}` : null,
      meal: l.meal,
      symptoms: l.symptoms,
      anxietyLevel: l.anxiety_level,
      heartRate: l.heart_rate,
      peakFlow: l.peak_flow,
      inhalerPuffs: l.inhaler_puffs,
      painLevel: l.pain_level
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Fetch logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve logs.' });
  }
});

app.post('/api/logs', authenticateToken, async (req, res) => {
  const { date, glucose, bp, meal, symptoms, anxietyLevel, heartRate, peakFlow, inhalerPuffs, painLevel } = req.body;
  let bpSys = null;
  let bpDia = null;

  if (bp) {
    const parts = bp.split('/');
    if (parts.length === 2) {
      bpSys = parseInt(parts[0]);
      bpDia = parseInt(parts[1]);
    }
  }

  try {
    await runQuery(`
      INSERT INTO logs (
        user_id, date, glucose, bp_systolic, bp_diastolic, meal, symptoms,
        anxiety_level, heart_rate, peak_flow, inhaler_puffs, pain_level
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        glucose = COALESCE(excluded.glucose, glucose),
        bp_systolic = COALESCE(excluded.bp_systolic, bp_systolic),
        bp_diastolic = COALESCE(excluded.bp_diastolic, bp_diastolic),
        meal = excluded.meal,
        symptoms = excluded.symptoms,
        anxiety_level = COALESCE(excluded.anxiety_level, anxiety_level),
        heart_rate = COALESCE(excluded.heart_rate, heart_rate),
        peak_flow = COALESCE(excluded.peak_flow, peak_flow),
        inhaler_puffs = COALESCE(excluded.inhaler_puffs, inhaler_puffs),
        pain_level = COALESCE(excluded.pain_level, pain_level)
    `, [
      req.userId, date, glucose, bpSys, bpDia, meal, symptoms,
      anxietyLevel ? Number(anxietyLevel) : null,
      heartRate ? Number(heartRate) : null,
      peakFlow ? Number(peakFlow) : null,
      inhalerPuffs ? Number(inhalerPuffs) : null,
      painLevel ? Number(painLevel) : null
    ]);

    // Update profiles table with calculated bp stage if bp was logged
    if (bpSys !== null && bpDia !== null) {
      let stage = 'Normal';
      if (bpSys >= 140 || bpDia >= 90) stage = 'Stage 2 Hypertension';
      else if ((bpSys >= 130 && bpSys <= 139) || (bpDia >= 80 && bpDia <= 89)) stage = 'Stage 1 Hypertension';
      else if (bpSys >= 120 && bpSys <= 129 && bpDia < 80) stage = 'Elevated Blood Pressure';
      
      await runQuery('UPDATE profiles SET bp_stage = ? WHERE user_id = ?', [stage, req.userId]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Save log error:', err);
    res.status(500).json({ error: 'Failed to save health log.' });
  }
});

// ----------------------------------------------------
// 4. PRESCRIPTIONS / MEDICATIONS ENDPOINTS
// ----------------------------------------------------

app.get('/api/medications', authenticateToken, async (req, res) => {
  try {
    const meds = await getAllRows('SELECT * FROM medications WHERE user_id = ?', [req.userId]);
    res.json(meds);
  } catch (err) {
    console.error('Fetch meds error:', err);
    res.status(500).json({ error: 'Failed to retrieve medications.' });
  }
});

app.post('/api/medications', authenticateToken, async (req, res) => {
  const { id, name, dose, frequency, taken, remainingHours } = req.body;
  try {
    await runQuery(`
      INSERT INTO medications (id, user_id, name, dose, frequency, taken, remaining_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id, user_id) DO UPDATE SET
        name = excluded.name,
        dose = excluded.dose,
        frequency = excluded.frequency,
        taken = excluded.taken,
        remaining_hours = excluded.remaining_hours
    `, [id, req.userId, name, dose, frequency, taken ? 1 : 0, remainingHours ?? 24]);

    res.json({ success: true });
  } catch (err) {
    console.error('Save med error:', err);
    res.status(500).json({ error: 'Failed to save medication prescription.' });
  }
});

app.delete('/api/medications/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await runQuery('DELETE FROM medications WHERE id = ? AND user_id = ?', [id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete med error:', err);
    res.status(500).json({ error: 'Failed to delete medication.' });
  }
});

// ----------------------------------------------------
// 5. CLINICAL COMPANION CHAT HISTORY
// ----------------------------------------------------

app.get('/api/chat', authenticateToken, async (req, res) => {
  try {
    const chat = await getAllRows('SELECT * FROM chat_history WHERE user_id = ? ORDER BY id ASC', [req.userId]);
    res.json(chat);
  } catch (err) {
    console.error('Fetch chat error:', err);
    res.status(500).json({ error: 'Failed to retrieve chat history.' });
  }
});

app.post('/api/chat', authenticateToken, async (req, res) => {
  const { sender, text, timestamp, category } = req.body;
  try {
    const result = await runQuery(`
      INSERT INTO chat_history (user_id, sender, text, timestamp, category)
      VALUES (?, ?, ?, ?, ?)
    `, [req.userId, sender, text, timestamp, category || null]);

    res.json({ id: result.id });
  } catch (err) {
    console.error('Save chat message error:', err);
    res.status(500).json({ error: 'Failed to save chat message.' });
  }
});

app.delete('/api/chat', authenticateToken, async (req, res) => {
  try {
    await runQuery('DELETE FROM chat_history WHERE user_id = ?', [req.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Clear chat error:', err);
    res.status(500).json({ error: 'Failed to clear chat log.' });
  }
});

app.post('/api/chat/companion', authenticateToken, async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(501).json({ error: 'GEMINI_API_KEY not configured. Falling back to rule-based engine.' });
  }

  const { messages, context } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages list is required.' });
  }

  try {
    const formattedHistory = messages.slice(-10).map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    // Formulate a clinical context prompt
    const systemPrompt = `You are a clinical wellness assistant for a chronic care management application called ChronicCare Companion.
Under GINA, ADA, and ACC/AHA guidelines, your goal is to help patients monitor their chronic conditions (Diabetes, Hypertension, Anxiety GAD-7, Asthma, and Chronic Pain).
CRITICAL CLINICAL RULES:
- Never provide formal medical diagnoses or modify drug treatments. Always advise consulting their primary care provider if readings are in dangerous zones.
- Be supportive, clear, and highly focused on measurement-based care.
- Reference their current vitals history, target ranges, and active medications if relevant.

Active Patient Context:
- Patient Profile Name: ${context?.profile?.name || 'Patient'}
- Chronic Conditions: ${context?.profile?.conditions || 'None configured'}
- Active Prescriptions: ${JSON.stringify(context?.medications || [])}
- Target Fasting Glucose: ${context?.profile?.glucoseFastingTargetMin ?? 80} - ${context?.profile?.glucoseFastingTargetMax ?? 130} mg/dL
- Target Blood Pressure: < ${context?.profile?.bpSystolicTargetMax ?? 130} / ${context?.profile?.bpDiastolicTargetMax ?? 80} mmHg
- Recent Vitals Logs: ${JSON.stringify((context?.logs || []).slice(-7))}

Provide a helpful, educational response to the user's latest query:`;

    // Incorporate the prompt into the model input
    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      },
      ...formattedHistory
    ];

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contents })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API call failed.');
    }

    const assistantText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I am sorry, I am unable to process that request right now.';
    res.json({ text: assistantText });
  } catch (err) {
    console.error('Gemini integration error:', err);
    res.status(500).json({ error: 'Failed to generate response from Clinical Companion AI.' });
  }
});

// ----------------------------------------------------
// 6. CLINICAL RISK ENGINE INTEGRATION ENDPOINT
// ----------------------------------------------------

app.get('/api/analysis', authenticateToken, async (req, res) => {
  try {
    const profile = await getRow('SELECT * FROM profiles WHERE user_id = ?', [req.userId]);
    if (!profile) {
      return res.status(404).json({ error: 'No profile details found. Please onboarding first.' });
    }

    const logs = await getAllRows('SELECT * FROM logs WHERE user_id = ? ORDER BY date ASC', [req.userId]);
    const meds = await getAllRows('SELECT * FROM medications WHERE user_id = ?', [req.userId]);

    const targets = {
      glucoseFastingTargetMin: profile.glucose_min,
      glucoseFastingTargetMax: profile.glucose_max,
      glucoseHypoThreshold: 70,
      bpSystolicTargetMax: profile.bp_sys_max,
      bpDiastolicTargetMax: profile.bp_dia_max,
    };

    const wellnessScore = computeWellnessScore(logs, meds, targets);
    
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).replace(',', '');
    const streakDays = calculateStreak(logs, meds, todayStr);
    const analysis = analyzeTrends(logs, targets);

    res.json({
      wellnessScore,
      streakDays,
      analysis
    });
  } catch (err) {
    console.error('Run analysis error:', err);
    res.status(500).json({ error: 'Failed to compute clinical analytics.' });
  }
});

// ----------------------------------------------------
// 7. SYSTEM ACTIVITY AUDIT LOGS
// ----------------------------------------------------

app.get('/api/activity_logs', authenticateToken, async (req, res) => {
  try {
    const logs = await getAllRows('SELECT * FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC', [req.userId]);
    res.json(logs);
  } catch (err) {
    console.error('Fetch activity error:', err);
    res.status(500).json({ error: 'Failed to retrieve activity log.' });
  }
});

app.post('/api/activity_logs', authenticateToken, async (req, res) => {
  const { actionType, description } = req.body;
  try {
    await runQuery(`
      INSERT INTO activity_logs (user_id, action_type, description, timestamp)
      VALUES (?, ?, ?, ?)
    `, [req.userId, actionType, description, new Date().toISOString()]);
    res.json({ success: true });
  } catch (err) {
    console.error('Save activity error:', err);
    res.status(500).json({ error: 'Failed to record user activity.' });
  }
});

// ----------------------------------------------------
// 8. PHYSICIAN PORTAL API ENDPOINTS
// ----------------------------------------------------

app.get('/api/physician/patients', authenticateToken, requirePhysician, async (req, res) => {
  try {
    const query = `
      SELECT users.id, users.email, profiles.name, profiles.conditions, profiles.bp_stage, physician_patient_links.status
      FROM physician_patient_links 
      JOIN users ON users.id = physician_patient_links.patient_id 
      JOIN profiles ON profiles.user_id = users.id 
      WHERE physician_patient_links.physician_id = ?
    `;
    const patients = await getAllRows(query, [req.userId]);
    res.json(patients);
  } catch (err) {
    console.error('Fetch physician patients failed:', err);
    res.status(500).json({ error: 'Failed to retrieve linked patients.' });
  }
});

app.post('/api/physician/link', authenticateToken, requirePhysician, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Please provide patient email address.' });
  }

  try {
    // 1. Check if patient exists
    const patient = await getRow('SELECT id FROM users WHERE email = ? AND role = \'patient\'', [email]);
    if (!patient) {
      return res.status(404).json({ error: 'Patient email address not found.' });
    }

    // 2. Check if already linked or request exists
    const linked = await getRow('SELECT status FROM physician_patient_links WHERE physician_id = ? AND patient_id = ?', [req.userId, patient.id]);
    if (linked) {
      if (linked.status === 'pending') {
        return res.status(409).json({ error: 'A pending connection request has already been sent to this patient.' });
      }
      return res.status(409).json({ error: 'Patient is already linked to your clinic.' });
    }

    // 3. Link them with pending status
    await runQuery('INSERT INTO physician_patient_links (physician_id, patient_id, status) VALUES (?, ?, \'pending\')', [req.userId, patient.id]);
    
    // Log Activity
    await runQuery(
      'INSERT INTO activity_logs (user_id, action_type, description, timestamp) VALUES (?, ?, ?, ?)',
      [req.userId, 'link_patient_request', `Requested link with patient: ${email} (pending consent)`, new Date().toISOString()]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Link patient failed:', err);
    res.status(500).json({ error: 'Failed to link patient account.' });
  }
});

app.get('/api/physician/patient/:id/logs', authenticateToken, requirePhysician, async (req, res) => {
  const { id } = req.params;

  try {
    const verified = await getRow('SELECT status FROM physician_patient_links WHERE physician_id = ? AND patient_id = ?', [req.userId, id]);
    if (!verified) {
      return res.status(403).json({ error: 'Access denied: Patient is not linked to your clinic.' });
    }
    if (verified.status !== 'active') {
      return res.status(403).json({ error: 'Access denied: Connection request is still pending patient approval.' });
    }

    const logs = await getAllRows('SELECT * FROM logs WHERE user_id = ? ORDER BY date ASC', [id]);
    const formatted = logs.map(l => ({
      date: l.date,
      glucose: l.glucose,
      bp: (l.bp_systolic && l.bp_diastolic) ? `${l.bp_systolic}/${l.bp_diastolic}` : null,
      meal: l.meal,
      symptoms: l.symptoms,
      anxietyLevel: l.anxiety_level,
      heartRate: l.heart_rate,
      peakFlow: l.peak_flow,
      inhalerPuffs: l.inhaler_puffs,
      painLevel: l.pain_level
    }));

    const profile = await getRow('SELECT * FROM profiles WHERE user_id = ?', [id]);

    res.json({ logs: formatted, profile: profile || null });
  } catch (err) {
    console.error('Fetch patient details failed:', err);
    res.status(500).json({ error: 'Failed to retrieve patient biometrics.' });
  }
});

// ----------------------------------------------------
// 8.5 PATIENT CONCENT LINKING MANAGEMENT ENDPOINTS
// ----------------------------------------------------

app.get('/api/patient/links', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT users.id AS physician_id, users.email AS physician_email, physician_patient_links.status
      FROM physician_patient_links
      JOIN users ON users.id = physician_patient_links.physician_id
      WHERE physician_patient_links.patient_id = ?
    `;
    const links = await getAllRows(query, [req.userId]);
    res.json(links);
  } catch (err) {
    console.error('Fetch patient links failed:', err);
    res.status(500).json({ error: 'Failed to retrieve connection requests.' });
  }
});

app.post('/api/patient/links/respond', authenticateToken, async (req, res) => {
  const { physicianId, accept } = req.body;
  if (!physicianId) {
    return res.status(400).json({ error: 'Physician ID is required.' });
  }
  try {
    if (accept) {
      await runQuery(
        'UPDATE physician_patient_links SET status = \'active\' WHERE physician_id = ? AND patient_id = ?',
        [physicianId, req.userId]
      );
      
      await runQuery(
        'INSERT INTO activity_logs (user_id, action_type, description, timestamp) VALUES (?, ?, ?, ?)',
        [req.userId, 'approve_link', `Approved connection with physician ID: ${physicianId}`, new Date().toISOString()]
      );
    } else {
      await runQuery(
        'DELETE FROM physician_patient_links WHERE physician_id = ? AND patient_id = ?',
        [physicianId, req.userId]
      );
      
      await runQuery(
        'INSERT INTO activity_logs (user_id, action_type, description, timestamp) VALUES (?, ?, ?, ?)',
        [req.userId, 'reject_link', `Rejected connection with physician ID: ${physicianId}`, new Date().toISOString()]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Respond to link failed:', err);
    res.status(500).json({ error: 'Failed to update connection request.' });
  }
});

app.post('/api/demo/seed', authenticateToken, async (req, res) => {
  const { scenario } = req.body;
  try {
    await runQuery('DELETE FROM logs WHERE user_id = ?', [req.userId]);

    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).replace(',', '');
      dates.push(dateStr);
    }

    let conditions = '';
    const logsToInsert = [];

    if (scenario === 'stable') {
      conditions = 'Diabetes, Hypertension';
      const glucoseVals = [94, 98, 102, 96, 101, 95, 99];
      const bpSysVals = [118, 120, 117, 119, 121, 118, 120];
      const bpDiaVals = [76, 78, 75, 77, 79, 76, 78];
      const anxietyVals = [2, 3, 2, 1, 3, 2, 2];
      const hrVals = [68, 70, 72, 69, 71, 68, 70];
      
      for (let i = 0; i < 7; i++) {
        logsToInsert.push({
          date: dates[i],
          glucose: glucoseVals[i],
          bpSys: bpSysVals[i],
          bpDia: bpDiaVals[i],
          meal: 'yes',
          symptoms: 'None',
          anxiety: anxietyVals[i],
          hr: hrVals[i],
          pf: null,
          puffs: null,
          pain: 1
        });
      }
    } else if (scenario === 'hypertension_risk') {
      conditions = 'Hypertension';
      const bpSysVals = [118, 122, 125, 129, 134, 138, 142];
      const bpDiaVals = [76, 78, 80, 82, 86, 88, 92];
      
      for (let i = 0; i < 7; i++) {
        logsToInsert.push({
          date: dates[i],
          glucose: null,
          bpSys: bpSysVals[i],
          bpDia: bpDiaVals[i],
          meal: 'n/a',
          symptoms: i >= 5 ? 'Mild headache' : 'None',
          anxiety: null,
          hr: 70 + i,
          pf: null,
          puffs: null,
          pain: null
        });
      }
    } else if (scenario === 'anxiety_vagal') {
      conditions = 'Anxiety';
      const anxietyVals = [4, 5, 12, 6, 15, 8, 18];
      const hrVals = [70, 72, 88, 74, 94, 78, 98];
      
      for (let i = 0; i < 7; i++) {
        logsToInsert.push({
          date: dates[i],
          glucose: null,
          bpSys: null,
          bpDia: null,
          meal: 'n/a',
          symptoms: anxietyVals[i] >= 10 ? 'Palpitations, mild panic' : 'None',
          anxiety: anxietyVals[i],
          hr: hrVals[i],
          pf: null,
          puffs: null,
          pain: null
        });
      }
    } else {
      return res.status(400).json({ error: 'Invalid demo scenario type.' });
    }

    for (const log of logsToInsert) {
      await runQuery(
        `INSERT INTO logs (
          user_id, date, glucose, bp_systolic, bp_diastolic, meal, symptoms,
          anxiety_level, heart_rate, peak_flow, inhaler_puffs, pain_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.userId, log.date, log.glucose, log.bpSys, log.bpDia, log.meal, log.symptoms,
          log.anxiety, log.hr, log.pf, log.puffs, log.pain
        ]
      );
    }

    await runQuery(
      'UPDATE profiles SET conditions = ? WHERE user_id = ?',
      [conditions, req.userId]
    );

    await runQuery(
      'INSERT INTO activity_logs (user_id, action_type, description, timestamp) VALUES (?, ?, ?, ?)',
      [req.userId, 'demo_seed', `Injected demo scenario: ${scenario}`, new Date().toISOString()]
    );

    res.json({ success: true, conditions });
  } catch (err) {
    console.error('Demo seeding failed:', err);
    res.status(500).json({ error: 'Failed to inject demo records.' });
  }
});


// ----------------------------------------------------
// 9. SECURE SSL / HTTPS BINDINGS
// ----------------------------------------------------

const sslKeyPath = path.join(__dirname, 'key.pem');
const sslCertPath = path.join(__dirname, 'cert.pem');

if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  const options = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath)
  };
  https.createServer(options, app).listen(PORT, () => {
    console.log(`ChronicCare Server listening over SECURE HTTPS on port ${PORT}`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`ChronicCare Server listening over HTTP on port ${PORT}`);
  });
}
