/* ----------------------------------------------------
   BACKEND REST API INTEGRATION CLIENT (src/utils/db.js)
   ---------------------------------------------------- */

const API_BASE_URL = 'http://localhost:5000/api';

export const isCloudEnabled = true;

// Helper: Retrieve active JWT session token
function getAuthToken() {
  return localStorage.getItem('cc_token');
}

// Helper: Handle backend fetch and attach JWT Authorization header
async function apiFetch(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401 || response.status === 403) {
    // Session expired or invalid token
    localStorage.removeItem('cc_token');
    throw new Error('AUTH_EXPIRED');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Server request failed.');
  }

  return data;
}

/* ----------------------------------------------------
   AUTHENTICATION API BRIDGE
   ---------------------------------------------------- */

export async function loginWithEmail(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (data.token) {
    localStorage.setItem('cc_token', data.token);
  }
  return { user: data.user };
}

export async function registerWithEmail(email, password) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (data.token) {
    localStorage.setItem('cc_token', data.token);
  }
  return { user: data.user };
}

export async function logoutUser() {
  localStorage.removeItem('cc_token');
  return Promise.resolve();
}

export async function resetPassword(email) {
  alert(`Password reset link sent to ${email} (simulated).`);
  return Promise.resolve();
}

export async function initFirebase() {
  return Promise.resolve(null);
}

/* ----------------------------------------------------
   INDEXEDDB FALLBACK COMPATIBILITY (NO-OPS)
   ---------------------------------------------------- */

export async function initDB() {
  return Promise.resolve(null);
}

export async function clearAllLocalData() {
  localStorage.removeItem('cc_token');
  return Promise.resolve();
}

export async function seedLocalData() {
  return Promise.resolve();
}

export async function syncCloudToLocal() {
  return Promise.resolve();
}

/* ----------------------------------------------------
   CLINICAL PROFILE API (WITH SCHEMA TRANSLATION)
   ---------------------------------------------------- */

export async function getProfile() {
  const data = await apiFetch('/profile');
  if (!data.profile) return null;
  const p = data.profile;
  return {
    name: p.name,
    conditions: p.conditions,
    physicianName: p.physician_name,
    physicianPhone: p.physician_phone,
    physicianClinic: p.physician_clinic,
    glucoseFastingTargetMin: p.glucose_min,
    glucoseFastingTargetMax: p.glucose_max,
    bpSystolicTargetMax: p.bp_sys_max,
    bpDiastolicTargetMax: p.bp_dia_max,
    bpStage: p.bp_stage
  };
}

export async function setProfile(profile) {
  return await apiFetch('/profile', {
    method: 'POST',
    body: JSON.stringify(profile)
  });
}

export async function getAnalysisData() {
  return await apiFetch('/analysis');
}

/* ----------------------------------------------------
   DAILY BIOMETRIC LOGS API
   ---------------------------------------------------- */

export async function getLogs() {
  return await apiFetch('/logs');
}

export async function addLog(log) {
  return await apiFetch('/logs', {
    method: 'POST',
    body: JSON.stringify(log)
  });
}

/* ----------------------------------------------------
   MEDICATIONS API (WITH SCHEMA TRANSLATION)
   ---------------------------------------------------- */

export async function getMedications() {
  const data = await apiFetch('/medications');
  return data.map(m => ({
    id: m.id,
    name: m.name,
    dose: m.dose,
    frequency: m.frequency,
    taken: m.taken === 1,
    remainingHours: m.remaining_hours
  }));
}

export async function updateMedication(med) {
  return await apiFetch('/medications', {
    method: 'POST',
    body: JSON.stringify({
      id: med.id,
      name: med.name,
      dose: med.dose,
      frequency: med.frequency,
      taken: med.taken ? 1 : 0,
      remainingHours: med.remainingHours
    })
  });
}

export async function deleteMedication(id) {
  return await apiFetch(`/medications/${id}`, {
    method: 'DELETE'
  });
}

/* ----------------------------------------------------
   CLINICAL CHAT TIMELINE API
   ---------------------------------------------------- */

export async function getMessages() {
  const messages = await apiFetch('/chat');
  return messages.map(m => ({
    sender: m.sender,
    text: m.text,
    timestamp: m.timestamp,
    category: m.category
  }));
}

export async function addMessage(msg) {
  const data = await apiFetch('/chat', {
    method: 'POST',
    body: JSON.stringify(msg)
  });
  return data.id;
}

export async function clearMessages() {
  return await apiFetch('/chat', {
    method: 'DELETE'
  });
}

/* ----------------------------------------------------
   AUDIT TRAIL LOGGING API (WITH SCHEMA TRANSLATION)
   ---------------------------------------------------- */

export async function getActivityLogs() {
  const data = await apiFetch('/activity_logs');
  return data.map(al => ({
    actionType: al.action_type,
    description: al.description,
    timestamp: al.timestamp
  }));
}

export async function logUserActivity(actionType, description) {
  try {
    return await apiFetch('/activity_logs', {
      method: 'POST',
      body: JSON.stringify({ actionType, description })
    });
  } catch (err) {
    console.warn('Silent log entry ignored (unauthenticated session).');
  }
}
