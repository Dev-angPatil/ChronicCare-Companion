/* ----------------------------------------------------
   BACKEND REST API INTEGRATION CLIENT (src/utils/db.js)
   ---------------------------------------------------- */

const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5000/api';
  const customIp = localStorage.getItem('cc_custom_server_ip');
  if (customIp) {
    return `http://${customIp}/api`;
  }
  const isCapacitor = window.origin?.includes('capacitor://') || 
    window.location?.href?.includes('capacitor://') || 
    navigator.userAgent?.includes('Capacitor') || 
    (typeof window.Capacitor !== 'undefined');
  
  return isCapacitor ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

export const isCloudEnabled = true;

// Helper: Retrieve active JWT session token
function getAuthToken() {
  return localStorage.getItem('cc_token');
}

// Trigger a custom window event when sync queue changes
function dispatchSyncQueueUpdate() {
  const event = new CustomEvent('cc_sync_queue_updated', {
    detail: { count: getOfflineQueueCount() }
  });
  window.dispatchEvent(event);
}

export function getOfflineQueueCount() {
  try {
    const queue = JSON.parse(localStorage.getItem('cc_offline_sync_queue') || '[]');
    return queue.length;
  } catch (e) {
    return 0;
  }
}

// Helper: Handle backend fetch and attach JWT Authorization header
async function apiFetch(endpoint, options = {}) {
  const token = getAuthToken();
  const method = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
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

    // Cache successful GET responses
    if (method === 'GET') {
      localStorage.setItem('cc_cache_' + endpoint, JSON.stringify(data));
    }

    return data;
  } catch (err) {
    if (err.message === 'AUTH_EXPIRED') {
      throw err;
    }

    // Detect if this is a network connectivity error
    const isNetworkError = err.name === 'TypeError' || 
                           err.message.includes('Failed to fetch') || 
                           err.message.includes('Failed to execute \'fetch\'') ||
                           err.message.includes('network');

    if (isNetworkError) {
      console.warn(`Network error detected during API fetch to ${endpoint}. Attempting offline fallback.`);

      if (method === 'GET') {
        const cached = localStorage.getItem('cc_cache_' + endpoint);
        if (cached) {
          console.log(`Returning cached response for GET ${endpoint}`);
          return JSON.parse(cached);
        }
        throw new Error('You are currently offline, and no cached clinical data is available.');
      } else {
        // Do not queue real-time AI companion chatbot requests
        if (endpoint === '/chat/companion') {
          throw new Error('Clinical AI Companion requires an active internet connection.');
        }

        // Queue modifications
        const queue = JSON.parse(localStorage.getItem('cc_offline_sync_queue') || '[]');
        queue.push({
          id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
          endpoint,
          method,
          body: options.body
        });
        localStorage.setItem('cc_offline_sync_queue', JSON.stringify(queue));
        dispatchSyncQueueUpdate();

        console.log(`Queued offline request: ${method} ${endpoint}`);
        
        // Return mock success payload
        if (endpoint === '/chat') {
          return { id: 'offline_' + Date.now(), success: true };
        }
        return { success: true, offline: true };
      }
    }

    throw err;
  }
}

export async function syncOfflineQueue() {
  const queueStr = localStorage.getItem('cc_offline_sync_queue');
  if (!queueStr) return 0;
  
  let queue = [];
  try {
    queue = JSON.parse(queueStr);
  } catch (e) {
    localStorage.removeItem('cc_offline_sync_queue');
    dispatchSyncQueueUpdate();
    return 0;
  }
  
  if (queue.length === 0) return 0;
  
  console.log(`Found ${queue.length} offline queued requests. Starting synchronization...`);
  
  const remaining = [];
  
  for (const item of queue) {
    try {
      const token = getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      
      const response = await fetch(`${API_BASE_URL}${item.endpoint}`, {
        method: item.method,
        headers,
        body: item.body
      });
      
      if (!response.ok) {
        // If it's a client error (e.g. 400 Bad Request, 404), skip it so we don't block sync
        // Keep in queue if it's a server error (5xx) or if connectivity dropped again
        if (response.status >= 500) {
          remaining.push(item);
        } else {
          console.warn(`Sync failed for item ${item.endpoint} with status ${response.status}. Skipping.`);
        }
      }
    } catch (err) {
      console.warn(`Sync fetch failed for ${item.endpoint}. Keeping in queue:`, err);
      remaining.push(item);
    }
  }
  
  if (remaining.length > 0) {
    localStorage.setItem('cc_offline_sync_queue', JSON.stringify(remaining));
  } else {
    localStorage.removeItem('cc_offline_sync_queue');
  }
  
  dispatchSyncQueueUpdate();
  return remaining.length;
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

export async function registerWithEmail(email, password, role) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, role })
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
  localStorage.removeItem('cc_offline_sync_queue');
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cc_cache_')) {
      localStorage.removeItem(key);
    }
  }
  dispatchSyncQueueUpdate();
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

/* ----------------------------------------------------
   PHYSICIAN PORTAL API CALLS
   ---------------------------------------------------- */

export async function getPhysicianPatients() {
  return await apiFetch('/physician/patients');
}

export async function linkPatient(email) {
  return await apiFetch('/physician/link', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function getPatientLogs(id) {
  return await apiFetch(`/physician/patient/${id}/logs`);
}

/* ----------------------------------------------------
   PATIENT CONSENT LINKING CALLS
   ---------------------------------------------------- */

export async function getPatientLinks() {
  return await apiFetch('/patient/links');
}

export async function respondToLink(physicianId, accept) {
  return await apiFetch('/patient/links/respond', {
    method: 'POST',
    body: JSON.stringify({ physicianId, accept })
  });
}

export async function getGeminiResponse(messages, context) {
  return await apiFetch('/chat/companion', {
    method: 'POST',
    body: JSON.stringify({ messages, context })
  });
}

export async function seedDemoScenario(scenario) {
  return await apiFetch('/demo/seed', {
    method: 'POST',
    body: JSON.stringify({ scenario })
  });
}

