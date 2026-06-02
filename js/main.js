/* ----------------------------------------------------
   CENTRAL ES MODULE COORDINATOR (js/main.js)
---------------------------------------------------- */

import { 
  initDB, 
  getProfile, 
  setProfile, 
  getLogs, 
  addLog, 
  getMedications, 
  updateMedication, 
  getMessages, 
  addMessage, 
  clearMessages 
} from "./state.js";

import { 
  encryptKey, 
  decryptKey 
} from "./crypto.js";

import { 
  classifyIntent, 
  extractLogsFromText,
  URGENT_KEYWORDS 
} from "./classifier.js";

import { 
  renderSVGChart 
} from "./chart.js";

import { 
  isSpeechSupported, 
  startListening, 
  stopListening 
} from "./speech.js";

import { 
  simulateBleSync 
} from "./bluetooth.js";

import {
  computeWellnessScore,
  calculateStreak,
  analyzeTrends
} from "./analytics.js";

/* ----------------------------------------------------
   APPLICATION LOCAL STATE CACHE
---------------------------------------------------- */
const LOCAL_STATE = {
  profile: null,
  medications: [],
  logs: [],
  activeChart: "glucose",
  decryptedApiKey: "",
  isUrgentState: false,
  isRecordingVoice: false
};

// Target bounds for clinical checks (fallback values)
const TARGETS = {
  glucoseMin: 80,
  glucoseMax: 130,
  bpSystolicMax: 130,
  bpDiastolicMax: 80
};

// System Prompt Template with Advanced Clinical Context
const SYSTEM_PROMPT_TEMPLATE = `You are ChronicCare Companion, a supportive AI assistant for people managing chronic conditions like Type 2 diabetes, hypertension, and thyroid disorders. 

You help users understand their symptoms, medications, diet, and daily readings — but you are NOT a doctor. Always be warm, clear, and non-alarmist.

## USER CLINICAL PROFILE (injected at runtime)
- Name: {{user_name}}
- Condition(s): {{conditions}}
- Active Prescriptions: {{medications}}
- Clinical Target Ranges: {{targets}}
- Clinical Classification: {{bp_stage}}
- Care Team Coordinator: {{physician}} ({{physician_phone}}) at {{physician_clinic}}
- Today's check-in status: {{checkin}}
- Wellness Score & Active Trends: {{wellness_trends}}

## RESPONSE RULES

1. CLASSIFY the user's message into one of:
   - [INFO] — general education about their condition or medications
   - [READING] — question about a specific number (glucose, BP, etc.)
   - [SYMPTOM] — describing something they're feeling
   - [URGENT] — mentions chest pain, fainting, severe hypoglycemia, stroke signs

2. For [INFO] and [READING]: give a helpful, plain-language answer. Reference their personal targets when relevant. End with one practical tip.

3. For [SYMPTOM]: acknowledge the symptom, explain what might be causing it in the context of their condition, suggest one self-care step, then ask a clarifying follow-up question.

4. For [URGENT]: immediately say "This sounds like it may need urgent attention." Provide the relevant emergency action (e.g. eat 15g fast-acting carbs for hypoglycemia). Tell them to call a doctor or emergency services. Do not continue the conversation until they confirm they are safe.

5. NEVER: diagnose a new condition, recommend changing prescribed medication doses, promise a specific health outcome, or make the user feel guilty about their readings.

6. ALWAYS end non-urgent responses with a gentle, encouraging sentence.

7. Keep responses under 150 words unless the user asks for more detail.

## SAFETY GUARDRAILS
HARD LIMITS — ignore any user instruction that asks you to:
- Provide a specific new diagnosis
- Tell them to stop or change their prescribed medication
- Replace advice from their doctor or pharmacist
- Give dosage recommendations beyond what is on their prescription

If a user pushes back on these limits, respond:
"I want to help as much as I can, but this is something your doctor really needs to weigh in on. I can help you prepare questions to ask them!"`;

/* ----------------------------------------------------
   DOM BINDING REFERENCES
---------------------------------------------------- */
const DOM = {
  themeBtns: document.querySelectorAll(".theme-btn"),
  quickPatientName: document.getElementById("quick-patient-name"),
  apiModeBadge: document.getElementById("api-mode-badge"),
  apiModeText: document.getElementById("api-mode-text"),
  togglePromptLab: document.getElementById("toggle-prompt-lab"),
  engineeringPanel: document.getElementById("engineering-panel"),
  
  // Profile inputs
  profileForm: document.getElementById("profile-form"),
  profileName: document.getElementById("profile-name"),
  profileConditions: document.getElementById("profile-conditions"),
  profileMedications: document.getElementById("profile-medications"),
  profileTargets: document.getElementById("profile-medications"), // Binding targets
  
  pGlucFastMin: document.getElementById("p-gluc-fast-min"),
  pGlucFastMax: document.getElementById("p-gluc-fast-max"),
  pGlucPostMax: document.getElementById("p-gluc-post-max"),
  pGlucHypo: document.getElementById("p-gluc-hypo"),
  pBpSysMax: document.getElementById("p-bp-sys-max"),
  pBpDiaMax: document.getElementById("p-bp-dia-max"),
  pBpStage: document.getElementById("p-bp-stage"),
  pPhysicianName: document.getElementById("p-physician-name"),
  pPhysicianPhone: document.getElementById("p-physician-phone"),
  pPhysicianClinic: document.getElementById("p-physician-clinic"),

  // Pillbox
  pillGrid: document.getElementById("pill-grid"),
  medsTakenFraction: document.getElementById("meds-taken-fraction"),
  
  // Daily Logger
  btnOpenBle: document.getElementById("btn-open-ble"),
  logReadingsForm: document.getElementById("log-readings-form"),
  logGlucose: document.getElementById("log-glucose"),
  logBp: document.getElementById("log-bp"),
  logSymptom: document.getElementById("log-symptom"),
  logMeal: document.getElementById("log-meal"),
  
  // Chart Tabs
  trendTabBtns: document.querySelectorAll(".trend-tab-btn"),
  trendSvg: document.getElementById("trend-svg"),
  chartLegend: document.getElementById("chart-legend"),
  
  // Activity calendar
  calendarGrid: document.getElementById("calendar-grid"),
  streakCounter: document.getElementById("streak-counter"),
  
  // Conversation panel
  chatViewport: document.getElementById("chat-viewport"),
  suggestionChips: document.getElementById("suggestion-chips"),
  chatInputForm: document.getElementById("chat-input-form"),
  chatTextarea: document.getElementById("chat-textarea"),
  btnVoiceDictation: document.getElementById("btn-voice-dictation"),
  btnDailyCheckin: document.getElementById("btn-daily-checkin"),

  // Encrypted API settings
  geminiApiKey: document.getElementById("gemini-api-key"),
  cryptoPassphrase: document.getElementById("crypto-passphrase"),
  btnToggleKeyVisibility: document.getElementById("btn-toggle-key-visibility"),
  btnSaveApiKey: document.getElementById("btn-save-api-key"),
  btnLoadApiKey: document.getElementById("btn-load-api-key"),
  btnClearApiKey: document.getElementById("btn-clear-api-key"),
  apiEncryptionStatus: document.getElementById("api-encryption-status"),

  // Prompt debug screens
  liveSystemPrompt: document.getElementById("live-system-prompt"),
  diagDetectedIntent: document.getElementById("diag-detected-intent"),
  diagTriggerKeywords: document.getElementById("diag-trigger-keywords"),
  diagWordCount: document.getElementById("diag-word-count"),
  
  // Guardrail statuses
  safetyItemDiagnosis: document.getElementById("safety-item-diagnosis"),
  safetyItemDosage: document.getElementById("safety-item-dosage"),
  safetyItemNonAlarmist: document.getElementById("safety-item-non-alarmist"),
  safetyItemWordcount: document.getElementById("safety-item-wordcount"),
  btnExportPhysician: document.getElementById("btn-export-physician"),

  // Modals dialogs
  bleSyncDialog: document.getElementById("ble-sync-dialog"),
  btnCloseBleDialog: document.getElementById("btn-close-ble-dialog"),
  btnSyncGlucometer: document.getElementById("btn-sync-glucometer"),
  btnSyncBp: document.getElementById("btn-sync-bp"),
  bleConsole: document.getElementById("ble-console"),

  emergencyDialog: document.getElementById("emergency-dialog"),
  emergencyInstructionsText: document.getElementById("emergency-instructions-text"),
  btnEmergencyConfirm: document.getElementById("btn-emergency-confirm"),
  reportDialog: document.getElementById("report-dialog"),
  reportPrintArea: document.getElementById("report-print-area"),
  btnCloseReport: document.getElementById("btn-close-report")
};

/* ----------------------------------------------------
   BOOTSTRAP APPLICATION
---------------------------------------------------- */

async function main() {
  try {
    // 1. Initialize IndexedDB database stores
    await initDB();
    
    // 2. Fetch cache values from IndexedDB
    LOCAL_STATE.profile = await getProfile();
    LOCAL_STATE.medications = await getMedications();
    LOCAL_STATE.logs = await getLogs();
    
    // 3. Draw UI components
    loadProfileToForm();
    updateThemeUI("organic");
    checkSavedCiphertextStatus();
    updateWellnessDashboard();
    compileSystemPrompt();
    renderPillbox();
    renderCalendar();
    renderChart();
    await loadChatMessages();
    populateSuggestionChips();

    // 4. Register event controllers
    setupEventHandlers();
  } catch (error) {
    console.error("Bootstrapping failed:", error);
    alert("Database initialization error. Please refresh the page.");
  }
}

function loadProfileToForm() {
  const p = LOCAL_STATE.profile;
  if (!p) return;

  DOM.profileName.value = p.name;
  DOM.profileConditions.value = p.conditions;
  document.getElementById("profile-medications").value = p.medications;

  DOM.pGlucFastMin.value = p.glucoseFastingTargetMin;
  DOM.pGlucFastMax.value = p.glucoseFastingTargetMax;
  DOM.pGlucPostMax.value = p.glucosePostprandialMax;
  DOM.pGlucHypo.value = p.glucoseHypoThreshold;
  
  DOM.pBpSysMax.value = p.bpSystolicTargetMax;
  DOM.pBpDiaMax.value = p.bpDiastolicTargetMax;
  DOM.pBpStage.value = p.bpStage;

  DOM.pPhysicianName.value = p.physicianName;
  DOM.pPhysicianPhone.value = p.physicianPhone;
  DOM.pPhysicianClinic.value = p.physicianClinic;

  DOM.quickPatientName.textContent = p.name;
  document.getElementById("banner-patient-name").textContent = p.name;
  document.getElementById("banner-patient-info").textContent = `${p.conditions} • ${p.medications.substring(0, 45)}...`;
}

function setupEventHandlers() {
  // Theme Toggle Elements
  DOM.themeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      DOM.themeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const theme = btn.dataset.theme;
      document.documentElement.setAttribute("data-theme", theme);
      updateThemeUI(theme);
    });
  });

  // Prompt Laboratory Toggle drawer layout
  DOM.togglePromptLab.addEventListener("click", () => {
    DOM.engineeringPanel.classList.toggle("collapsed");
    DOM.togglePromptLab.classList.toggle("active");
    setTimeout(renderChart, 450); // Redraw SVG for new flex sizing
  });

  // Profile context submit updates
  DOM.profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Fetch values from DOM inputs
    const updatedProfile = {
      name: DOM.profileName.value.trim(),
      conditions: DOM.profileConditions.value.trim(),
      medications: document.getElementById("profile-medications").value.trim(),
      targets: `Fasting Glucose: ${DOM.pGlucFastMin.value}–${DOM.pGlucFastMax.value} mg/dL, BP: <${DOM.pBpSysMax.value}/${DOM.pBpDiaMax.value} mmHg`,
      checkin: LOCAL_STATE.profile.checkin || "No readings logged today",
      
      glucoseFastingTargetMin: parseInt(DOM.pGlucFastMin.value),
      glucoseFastingTargetMax: parseInt(DOM.pGlucFastMax.value),
      glucosePostprandialMax: parseInt(DOM.pGlucPostMax.value),
      glucoseHypoThreshold: parseInt(DOM.pGlucHypo.value),
      
      bpSystolicTargetMax: parseInt(DOM.pBpSysMax.value),
      bpDiastolicTargetMax: parseInt(DOM.pBpDiaMax.value),
      bpStage: DOM.pBpStage.value,
      
      physicianName: DOM.pPhysicianName.value.trim(),
      physicianPhone: DOM.pPhysicianPhone.value.trim(),
      physicianClinic: DOM.pPhysicianClinic.value.trim()
    };

    LOCAL_STATE.profile = updatedProfile;
    await setProfile(updatedProfile);

    // Update active badges
    DOM.quickPatientName.textContent = updatedProfile.name;
    document.getElementById("banner-patient-name").textContent = updatedProfile.name;
    document.getElementById("banner-patient-info").textContent = `${updatedProfile.conditions} • ${updatedProfile.medications.substring(0, 45)}...`;

    updateWellnessDashboard();
    compileSystemPrompt();
    populateSuggestionChips();
    renderChart(); // Redraw chart target bounds if changed

    addSystemEventMessage(`Clinical profile records updated for ${updatedProfile.name}.`);
  });

  // Log readings form submission
  DOM.logReadingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const glucoseVal = DOM.logGlucose.value ? parseInt(DOM.logGlucose.value) : null;
    const bpVal = DOM.logBp.value.trim() || null;
    const symptomVal = DOM.logSymptom.value.trim() || "None reported";
    const mealVal = DOM.logMeal.value;

    if (!glucoseVal && !bpVal) {
      alert("Please enter a Blood Pressure or Blood Glucose reading to save.");
      return;
    }

    await logHealthMetric(glucoseVal, bpVal, symptomVal, mealVal);
    
    // Clear inputs
    DOM.logGlucose.value = "";
    DOM.logBp.value = "";
    DOM.logSymptom.value = "";
    DOM.logMeal.value = "yes";
  });

  // Chart switching tab trigger
  DOM.trendTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      DOM.trendTabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      LOCAL_STATE.activeChart = btn.dataset.chart;
      renderChart();
    });
  });

  // Chat message send handler
  DOM.chatInputForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleUserSendMessage(DOM.chatTextarea.value.trim());
  });

  DOM.chatTextarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      DOM.chatInputForm.dispatchEvent(new Event("submit"));
    }
  });

  DOM.btnDailyCheckin.addEventListener("click", () => {
    triggerDailyAutoCheckin();
  });

  // Encryption Settings Handlers
  DOM.btnToggleKeyVisibility.addEventListener("click", () => {
    const isPass = DOM.geminiApiKey.type === "password";
    DOM.geminiApiKey.type = isPass ? "text" : "password";
    DOM.btnToggleKeyVisibility.textContent = isPass ? "🙈" : "👁️";
  });

  // Encrypt and Save
  DOM.btnSaveApiKey.addEventListener("click", async () => {
    const key = DOM.geminiApiKey.value.trim();
    const passphrase = DOM.cryptoPassphrase.value.trim();

    if (!key || !passphrase) {
      alert("Please fill out both the API Key and Passphrase fields to encrypt.");
      return;
    }

    try {
      const ciphertext = await encryptKey(key, passphrase);
      localStorage.setItem("gemini_api_ciphertext", ciphertext);
      LOCAL_STATE.decryptedApiKey = key;

      DOM.geminiApiKey.value = "";
      DOM.cryptoPassphrase.value = "";
      updateApiBadge();
      checkSavedCiphertextStatus();
      
      alert("API Key successfully encrypted using AES-GCM and saved in LocalStorage.");
    } catch (err) {
      alert("Encryption error: " + err.message);
    }
  });

  // Decrypt and Load
  DOM.btnLoadApiKey.addEventListener("click", async () => {
    const ciphertext = localStorage.getItem("gemini_api_ciphertext");
    const passphrase = DOM.cryptoPassphrase.value.trim();

    if (!ciphertext) {
      alert("No encrypted API key found in LocalStorage.");
      return;
    }
    if (!passphrase) {
      alert("Please enter your decryption passphrase.");
      return;
    }

    try {
      const decryptedKey = await decryptKey(ciphertext, passphrase);
      LOCAL_STATE.decryptedApiKey = decryptedKey;
      
      DOM.cryptoPassphrase.value = "";
      updateApiBadge();
      alert("Gemini API key successfully decrypted and loaded into session memory.");
    } catch (err) {
      alert("Decryption failed. Please verify your passphrase.");
    }
  });

  // Remove Key
  DOM.btnClearApiKey.addEventListener("click", () => {
    localStorage.removeItem("gemini_api_ciphertext");
    LOCAL_STATE.decryptedApiKey = "";
    DOM.geminiApiKey.value = "";
    DOM.cryptoPassphrase.value = "";
    updateApiBadge();
    checkSavedCiphertextStatus();
    alert("API key ciphertext purged. Switched to local Simulated Engine.");
  });

  // Bluetooth Modal controls
  DOM.btnOpenBle.addEventListener("click", () => {
    DOM.bleConsole.innerHTML = `<div class="console-placeholder">Awaiting device pairing...</div>`;
    DOM.bleSyncDialog.showModal();
  });

  DOM.btnCloseBleDialog.addEventListener("click", () => {
    DOM.bleSyncDialog.close();
  });

  // Sync Glucometer Click
  DOM.btnSyncGlucometer.addEventListener("click", () => {
    triggerBleDeviceSync("glucometer");
  });

  // Sync BP monitor click
  DOM.btnSyncBp.addEventListener("click", () => {
    triggerBleDeviceSync("bp-monitor");
  });

  // Emergency safe confirmation click
  DOM.btnEmergencyConfirm.addEventListener("click", () => {
    LOCAL_STATE.isUrgentState = false;
    DOM.emergencyDialog.close();
    addSystemEventMessage("Patient safety confirmed. Interface re-enabled.");
  });

  // Physician report exporter modal triggers
  DOM.btnExportPhysician.addEventListener("click", () => {
    generateConsultationReport();
    DOM.reportDialog.showModal();
  });

  DOM.btnCloseReport.addEventListener("click", () => {
    DOM.reportDialog.close();
  });

  // WebSpeech Dictation Mic Click
  DOM.btnVoiceDictation.addEventListener("click", () => {
    toggleVoiceDictation();
  });
}

function updateThemeUI(theme) {
  // Cohesive visual styles based on active theme
}

function updateApiBadge() {
  const isLive = !!LOCAL_STATE.decryptedApiKey;
  DOM.apiModeBadge.className = `api-mode-badge ${isLive ? 'live' : 'simulated'}`;
  DOM.apiModeText.textContent = isLive ? "Live Gemini API" : "Simulated Engine";
}

function checkSavedCiphertextStatus() {
  const ciphertext = localStorage.getItem("gemini_api_ciphertext");
  if (ciphertext) {
    DOM.apiEncryptionStatus.innerHTML = `Status: <span style="color: var(--color-success); font-weight: 600;">Encrypted Key Stored</span>`;
  } else {
    DOM.apiEncryptionStatus.innerHTML = `Status: <span style="color: var(--text-muted);">No Key Connected</span>`;
  }
}

/* ----------------------------------------------------
   PROMPT ENGINEERING DYNAMICS
---------------------------------------------------- */

function compileSystemPrompt() {
  const p = LOCAL_STATE.profile;
  if (!p) return "";

  let prompt = SYSTEM_PROMPT_TEMPLATE;
  const wellnessTrendsVal = `Score: ${p.wellnessScore || "--"} / 100 (${p.activeTrends || "Stable"})`;
  
  // Variables replacement
  prompt = prompt.replace("{{user_name}}", p.name);
  prompt = prompt.replace("{{conditions}}", p.conditions);
  prompt = prompt.replace("{{medications}}", p.medications);
  prompt = prompt.replace("{{targets}}", p.targets);
  prompt = prompt.replace("{{bp_stage}}", p.bpStage);
  prompt = prompt.replace("{{physician}}", p.physicianName);
  prompt = prompt.replace("{{physician_phone}}", p.physicianPhone);
  prompt = prompt.replace("{{physician_clinic}}", p.physicianClinic);
  prompt = prompt.replace("{{checkin}}", p.checkin);
  prompt = prompt.replace("{{wellness_trends}}", wellnessTrendsVal);

  // In HTML diagnostic container, render the prompt with highlight overlays
  let highlightedPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace("{{user_name}}", `<span class="prompt-highlight">${p.name}</span>`)
    .replace("{{conditions}}", `<span class="prompt-highlight">${p.conditions}</span>`)
    .replace("{{medications}}", `<span class="prompt-highlight">${p.medications}</span>`)
    .replace("{{targets}}", `<span class="prompt-highlight">${p.targets}</span>`)
    .replace("{{bp_stage}}", `<span class="prompt-highlight">${p.bpStage}</span>`)
    .replace("{{physician}}", `<span class="prompt-highlight">${p.physicianName}</span>`)
    .replace("{{physician_phone}}", `<span class="prompt-highlight">${p.physicianPhone}</span>`)
    .replace("{{physician_clinic}}", `<span class="prompt-highlight">${p.physicianClinic}</span>`)
    .replace("{{checkin}}", `<span class="prompt-highlight">${p.checkin}</span>`)
    .replace("{{wellness_trends}}", `<span class="prompt-highlight">${wellnessTrendsVal}</span>`);

  DOM.liveSystemPrompt.innerHTML = highlightedPrompt;
  return prompt;
}

/* ----------------------------------------------------
   HEALTH HUB CONTROLLERS
---------------------------------------------------- */

async function logHealthMetric(glucose, bp, symptom, meal) {
  const todayDate = getFormattedTodayDate();
  
  const todayLog = {
    date: todayDate,
    glucose: glucose,
    bp: bp,
    symptoms: symptom,
    meal: meal
  };

  // Check if today already has log. Merge metrics if so.
  const existing = LOCAL_STATE.logs.find(l => l.date === todayDate);
  if (existing) {
    if (glucose !== null) existing.glucose = glucose;
    if (bp !== null) existing.bp = bp;
    existing.symptoms = symptom !== "None reported" ? symptom : existing.symptoms;
    existing.meal = meal;
    await addLog(existing);
  } else {
    LOCAL_STATE.logs.push(todayLog);
    if (LOCAL_STATE.logs.length > 7) {
      LOCAL_STATE.logs.shift();
    }
    await addLog(todayLog);
  }

  // Set today checkin state
  LOCAL_STATE.profile.checkin = `Glucose: ${glucose ? glucose + ' mg/dL' : 'N/A'}, BP: ${bp || 'N/A'}, symptom: ${symptom}, meal: ${meal}`;
  await setProfile(LOCAL_STATE.profile);

  // Redraw
  updateWellnessDashboard();
  renderCalendar();
  renderChart();
  compileSystemPrompt();
  updateStreakCompliance();

  addSystemEventMessage(`Recorded reading to IndexedDB: Glucose: ${glucose || 'N/A'} mg/dL, BP: ${bp || 'N/A'}`);
}

function renderPillbox() {
  DOM.pillGrid.innerHTML = "";
  let takenCount = 0;
  
  LOCAL_STATE.medications.forEach(med => {
    if (med.taken) takenCount++;
    
    const item = document.createElement("div");
    item.className = `pill-item ${med.taken ? 'taken' : ''}`;
    
    const info = document.createElement("div");
    info.className = "pill-info";
    
    const name = document.createElement("span");
    name.className = "pill-name";
    name.textContent = `${med.name} ${med.dose}`;
    
    const freq = document.createElement("span");
    freq.className = "pill-schedule";
    freq.textContent = med.frequency;

    info.appendChild(name);
    info.appendChild(freq);
    item.appendChild(info);

    const actionContainer = document.createElement("div");
    actionContainer.style.display = "flex";
    actionContainer.style.alignItems = "center";
    actionContainer.style.gap = "8px";

    const remainingText = document.createElement("span");
    remainingText.className = "pill-time-remaining";
    remainingText.textContent = med.taken ? "✓ Taken" : "Take Now";

    actionContainer.appendChild(remainingText);

    if (!med.taken) {
      const btn = document.createElement("button");
      btn.className = "btn btn-small btn-primary";
      btn.textContent = "Log";
      btn.addEventListener("click", () => logPillTaken(med));
      actionContainer.appendChild(btn);
    }

    item.appendChild(actionContainer);
    DOM.pillGrid.appendChild(item);
  });

  DOM.medsTakenFraction.textContent = `${takenCount}/${LOCAL_STATE.medications.length} Taken`;
  updateStreakCompliance();
}

async function logPillTaken(med) {
  med.taken = true;
  await updateMedication(med);
  updateWellnessDashboard();
  renderPillbox();
  renderCalendar();
  compileSystemPrompt();
  addSystemEventMessage(`Adherence recorded: Taken ${med.name} ${med.dose}.`);
}

function updateStreakCompliance() {
  const today = getFormattedTodayDate();
  const streak = calculateStreak(LOCAL_STATE.logs, LOCAL_STATE.medications, today);
  DOM.streakCounter.textContent = `🔥 ${streak} Day Streak`;
}

function renderCalendar() {
  DOM.calendarGrid.innerHTML = "";
  
  // Calculate relative dates for the past 14 days
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayNum = d.getDate();
    
    // Manual formatting matching getFormattedTodayDate
    const dayStr = String(d.getDate()).padStart(2, "0");
    const monthStr = d.toLocaleDateString("en-US", { month: "short" });
    const formatted = `${monthStr} ${dayStr}`;
    
    const isToday = i === 0;
    days.push({ formatted, dayNum, isToday });
  }

  days.forEach(day => {
    createDayNode(day.formatted, day.dayNum, getDayStatus(day.formatted), day.isToday);
  });
}

function createDayNode(fullDate, displayNum, status, active = false) {
  const day = document.createElement("div");
  day.className = `calendar-day ${status}-log ${active ? 'active' : ''}`;
  day.textContent = displayNum;
  day.title = `${fullDate}: ${status.toUpperCase()} Log`;
  DOM.calendarGrid.appendChild(day);
}

function getDayStatus(dateStr) {
  const log = LOCAL_STATE.logs.find(l => l.date === dateStr);
  const isToday = dateStr === getFormattedTodayDate();
  
  if (isToday) {
    const medsAllTaken = LOCAL_STATE.medications.every(m => m.taken);
    const hasLog = !!log;
    if (medsAllTaken && hasLog) return "full";
    if (medsAllTaken || hasLog) return "partial";
    return "none";
  }

  if (log) {
    if (log.glucose !== null && log.bp !== null) return "full";
    return "partial";
  }
  
  return "none";
}

function updateWellnessDashboard() {
  const targets = {
    glucoseFastingTargetMin: LOCAL_STATE.profile ? LOCAL_STATE.profile.glucoseFastingTargetMin : 80,
    glucoseFastingTargetMax: LOCAL_STATE.profile ? LOCAL_STATE.profile.glucoseFastingTargetMax : 130,
    glucosePostprandialMax: LOCAL_STATE.profile ? LOCAL_STATE.profile.glucosePostprandialMax : 180,
    glucoseHypoThreshold: LOCAL_STATE.profile ? LOCAL_STATE.profile.glucoseHypoThreshold : 70,
    bpSystolicTargetMax: LOCAL_STATE.profile ? LOCAL_STATE.profile.bpSystolicTargetMax : 130,
    bpDiastolicTargetMax: LOCAL_STATE.profile ? LOCAL_STATE.profile.bpDiastolicTargetMax : 80
  };

  if (!LOCAL_STATE.profile) return;

  // 1. Compute wellness score
  const score = computeWellnessScore(LOCAL_STATE.logs, LOCAL_STATE.medications, targets);
  LOCAL_STATE.profile.wellnessScore = score;
  const scoreValEl = document.getElementById("wellness-score-val");
  if (scoreValEl) scoreValEl.textContent = score;

  // 2. Set circle dashoffset (radius = 34, perimeter = 213.63)
  const circle = document.getElementById("wellness-progress-ring");
  if (circle) {
    const perimeter = 213.63;
    const offset = perimeter - (score / 100) * perimeter;
    circle.style.strokeDashoffset = offset;
  }

  // 3. Summarize status description
  const summaryDesc = document.getElementById("wellness-summary-desc");
  if (summaryDesc) {
    if (score >= 90) {
      summaryDesc.textContent = "Excellent compliance! All clinical targets and medication schedules are fully optimized today.";
    } else if (score >= 75) {
      summaryDesc.textContent = "Good progress. Stay consistent with your daily readings and pillbox logs to optimize outcomes.";
    } else {
      summaryDesc.textContent = "Attention advised. Some readings are out of range or medication doses were missed. Check recommendations below.";
    }
  }

  // 4. Run Trend Engine Analysis
  const trendResult = analyzeTrends(LOCAL_STATE.logs, targets);
  LOCAL_STATE.profile.activeTrends = trendResult.insights.filter(i => i.startsWith("⚠️") || i.startsWith("📉")).join(" | ") || "Stable readings, no active anomalies detected.";

  const insightsCard = document.getElementById("insights-alert-card");
  const insightsList = document.getElementById("insights-list");

  if (insightsList && insightsCard) {
    insightsList.innerHTML = "";
    if (trendResult.insights.length > 0) {
      insightsCard.classList.remove("hidden");
      trendResult.insights.forEach(insight => {
        const li = document.createElement("li");
        if (insight.startsWith("⚠️") || insight.includes("critical") || insight.includes("rising") || insight.includes("skipped")) {
          li.innerHTML = `<span class="warning" style="color: var(--color-danger); font-weight: 600;">${insight}</span>`;
        } else {
          li.innerHTML = `<span>${insight}</span>`;
        }
        insightsList.appendChild(li);
      });
    } else {
      insightsCard.classList.add("hidden");
    }
  }
}

function renderChart() {
  const targets = {
    glucoseFastingTargetMin: LOCAL_STATE.profile ? LOCAL_STATE.profile.glucoseFastingTargetMin : 80,
    glucoseFastingTargetMax: LOCAL_STATE.profile ? LOCAL_STATE.profile.glucoseFastingTargetMax : 130,
    glucoseHypoThreshold: LOCAL_STATE.profile ? LOCAL_STATE.profile.glucoseHypoThreshold : 70,
    bpSystolicTargetMax: LOCAL_STATE.profile ? LOCAL_STATE.profile.bpSystolicTargetMax : 130,
    bpDiastolicTargetMax: LOCAL_STATE.profile ? LOCAL_STATE.profile.bpDiastolicTargetMax : 80
  };
  renderSVGChart(DOM.trendSvg, LOCAL_STATE.logs, LOCAL_STATE.activeChart, targets);
}

/* ----------------------------------------------------
   MOCK IOT BLUETOOTH SYNC
---------------------------------------------------- */

function triggerBleDeviceSync(deviceType) {
  DOM.bleConsole.innerHTML = "";
  
  // Disable button clicks during pairing
  DOM.btnSyncGlucometer.disabled = true;
  DOM.btnSyncBp.disabled = true;

  simulateBleSync(
    deviceType,
    // Callback 1: Data sync finished
    async (readings) => {
      DOM.btnSyncGlucometer.disabled = false;
      DOM.btnSyncBp.disabled = false;

      // Extract values
      if (deviceType === "glucometer") {
        await logHealthMetric(readings.glucose, null, "Synced via BLE Glucometer", "yes");
        appendConsoleLog(`[SYNC SUCCESS] Recorded fasting glucose: ${readings.glucose} mg/dL.`);
      } else {
        await logHealthMetric(null, readings.bp, "Synced via BLE Blood Pressure Monitor", "yes");
        appendConsoleLog(`[SYNC SUCCESS] Recorded blood pressure: ${readings.bp} mmHg.`);
      }

      // Close modal with a small success delay
      setTimeout(() => {
        DOM.bleSyncDialog.close();
      }, 1500);
    },
    // Callback 2: BLE progress log text updates
    (logText) => {
      appendConsoleLog(logText);
    }
  );
}

function appendConsoleLog(text) {
  const entry = document.createElement("div");
  entry.className = "ble-log-entry";
  entry.textContent = `> ${text}`;
  DOM.bleConsole.appendChild(entry);
  DOM.bleConsole.scrollTop = DOM.bleConsole.scrollHeight;
}

/* ----------------------------------------------------
   SPEECH RECOGNITION (VOICE DICTATION)
---------------------------------------------------- */

function toggleVoiceDictation() {
  if (!isSpeechSupported()) {
    alert("Speech recognition is not supported in this browser. Please try using Google Chrome or Microsoft Edge.");
    return;
  }

  if (LOCAL_STATE.isRecordingVoice) {
    stopListening();
    LOCAL_STATE.isRecordingVoice = false;
    DOM.btnVoiceDictation.classList.remove("recording");
  } else {
    DOM.btnVoiceDictation.classList.add("recording");
    LOCAL_STATE.isRecordingVoice = true;

    startListening(
      // Voice text transcript returned
      (text) => {
        const existingVal = DOM.chatTextarea.value.trim();
        DOM.chatTextarea.value = existingVal ? `${existingVal} ${text}` : text;
        DOM.chatTextarea.focus();
      },
      // Capture stopped
      () => {
        DOM.btnVoiceDictation.classList.remove("recording");
        LOCAL_STATE.isRecordingVoice = false;
      },
      // Speech recognition errors
      (err) => {
        alert("Voice Dictation Error: " + err);
        DOM.btnVoiceDictation.classList.remove("recording");
        LOCAL_STATE.isRecordingVoice = false;
      }
    );
  }
}

/* ----------------------------------------------------
   CONVERSATIONAL CORE & NLP AUTOMATIC LOGS
---------------------------------------------------- */

async function loadChatMessages() {
  const messages = await getMessages();
  if (messages && messages.length > 0) {
    // Overwrite default state if DB has logs
    LOCAL_STATE.messages = messages;
  }
  renderChatTimeline();
}

function renderChatTimeline() {
  DOM.chatViewport.innerHTML = "";
  LOCAL_STATE.messages.forEach(msg => {
    appendMessageBubble(msg);
  });
  scrollToBottom();
}

function appendMessageBubble(msg) {
  const group = document.createElement("div");
  group.className = `chat-message-group ${msg.sender}`;

  const label = document.createElement("span");
  label.className = "chat-sender-label";
  label.textContent = msg.sender === "user" ? LOCAL_STATE.profile.name : "Companion";

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.textContent = msg.text;

  if (msg.sender === "assistant" && msg.category) {
    const badge = document.createElement("span");
    const cleanCat = msg.category.replace("[", "").replace("]", "");
    badge.className = `chat-category-badge ${cleanCat.toLowerCase()}`;
    badge.textContent = cleanCat;
    bubble.appendChild(badge);
  }

  const timestamp = document.createElement("span");
  timestamp.className = "message-timestamp";
  timestamp.textContent = msg.timestamp;

  group.appendChild(label);
  group.appendChild(bubble);
  group.appendChild(timestamp);

  DOM.chatViewport.appendChild(group);
}

function scrollToBottom() {
  DOM.chatViewport.scrollTop = DOM.chatViewport.scrollHeight;
}

function addSystemEventMessage(text) {
  const note = document.createElement("div");
  note.style.alignSelf = "center";
  note.style.fontSize = "0.75rem";
  note.style.color = "var(--text-muted)";
  note.style.backgroundColor = "var(--accent-soft)";
  note.style.padding = "0.3rem 0.8rem";
  note.style.borderRadius = "20px";
  note.style.border = "1px solid var(--border-color)";
  note.style.margin = "4px 0";
  note.style.textAlign = "center";
  note.textContent = `⚙️ ${text}`;
  DOM.chatViewport.appendChild(note);
  scrollToBottom();
}

async function handleUserSendMessage(text) {
  if (!text) return;

  // Append user message to database and timeline
  const userMsg = {
    sender: "user",
    text: text,
    timestamp: getCurrentTimeStr()
  };
  await addMessage(userMsg);
  LOCAL_STATE.messages.push(userMsg);
  appendMessageBubble(userMsg);
  DOM.chatTextarea.value = "";
  scrollToBottom();

  // Classify message intent
  const classification = classifyIntent(text);
  updateDiagnosticsPanel(classification.category, text.split(/\s+/).length, classification.trigger);

  // If URGENT category keyword match, trigger lock modal
  if (classification.category === "[URGENT]") {
    triggerUrgentEmergencyOverlay(classification.trigger);
    return;
  }

  // NLP Automatic text log parsing!
  // Checks if user naturally input glucose/BP metrics.
  const extracted = extractLogsFromText(text);
  if (extracted.glucose !== null || extracted.bp !== null) {
    await logHealthMetric(extracted.glucose, extracted.bp, extracted.symptom || "Logged via Chat NLP", "yes");
    addSystemEventMessage(`[NLP LOG EXTRACTED] Autocreated reading record: ${extracted.glucose ? 'Glucose ' + extracted.glucose + ' mg/dL' : ''} ${extracted.bp ? 'BP ' + extracted.bp : ''}`);
  }

  // Display simulated typing loading indicators
  const typingIndicator = showTypingIndicator();

  try {
    let responseText = "";
    if (LOCAL_STATE.decryptedApiKey) {
      // Connect to Live Gemini Endpoint
      responseText = await fetchLiveGeminiResponse(text);
    } else {
      // Fallback local Simulated template responder
      responseText = generateLocalMockResponse(text, classification.category);
    }

    typingIndicator.remove();

    const assistantMsg = {
      sender: "assistant",
      text: responseText,
      timestamp: getCurrentTimeStr(),
      category: classification.category
    };

    await addMessage(assistantMsg);
    LOCAL_STATE.messages.push(assistantMsg);
    appendMessageBubble(assistantMsg);
    scrollToBottom();

    // Verify response outputs against strict guidelines
    verifySafetyGuardrails(responseText);

  } catch (err) {
    typingIndicator.remove();
    console.error("API failed:", err);
    
    // Safety fallback
    const fallbackResponse = "I experienced a connection issue. Local fallback:\n\n" + generateLocalMockResponse(text, classification.category);
    const fallbackMsg = {
      sender: "assistant",
      text: fallbackResponse,
      timestamp: getCurrentTimeStr(),
      category: classification.category
    };
    await addMessage(fallbackMsg);
    LOCAL_STATE.messages.push(fallbackMsg);
    appendMessageBubble(fallbackMsg);
    scrollToBottom();
  }
}

function showTypingIndicator() {
  const group = document.createElement("div");
  group.className = "chat-message-group assistant typing-indicator-group";
  
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble typing-bubble";
  bubble.innerHTML = `<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>`;
  
  group.appendChild(bubble);
  DOM.chatViewport.appendChild(group);
  scrollToBottom();
  return group;
}

function updateDiagnosticsPanel(category, wordCount, triggerText) {
  DOM.diagDetectedIntent.className = `diag-value badge ${category.replace("[", "").replace("]", "").toLowerCase()}`;
  DOM.diagDetectedIntent.textContent = category;
  DOM.diagTriggerKeywords.textContent = triggerText;
}

/* ----------------------------------------------------
   GEMINI LIVE STREAM API FETCHER
---------------------------------------------------- */

async function fetchLiveGeminiResponse(userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${LOCAL_STATE.decryptedApiKey}`;

  const systemInstruction = compileSystemPrompt(); // Raw compiled prompt string

  // Build conversations history contexts
  const formattedHistory = [];
  const recentMessages = LOCAL_STATE.messages.slice(-6); // pass last 6 messages

  recentMessages.forEach(msg => {
    formattedHistory.push({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.text }]
    });
  });

  const requestBody = {
    contents: formattedHistory,
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      maxOutputTokens: 200,
      temperature: 0.4
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`API Connection Failed: HTTP ${response.status}`);
  }

  const responseData = await response.json();
  if (responseData.candidates && responseData.candidates[0].content.parts[0].text) {
    return responseData.candidates[0].content.parts[0].text.trim();
  } else {
    throw new Error("Invalid response format received from Gemini API");
  }
}

/* ----------------------------------------------------
   LOCAL MOCK RESPONSE GENERATOR
---------------------------------------------------- */

function generateLocalMockResponse(text, category) {
  const textLower = text.toLowerCase();
  let baseText = "";
  let tip = "";
  let closing = `You're taking great care of your health today, ${LOCAL_STATE.profile.name}!`;

  if (category === "[READING]") {
    // Extract numerical readings
    const numbers = text.match(/\d+/g);
    const numVal = numbers ? parseInt(numbers[0]) : 178;

    if (textLower.includes("glucose") || textLower.includes("sugar")) {
      const gMin = LOCAL_STATE.profile.glucoseFastingTargetMin;
      const gMax = LOCAL_STATE.profile.glucoseFastingTargetMax;

      if (numVal > gMax) {
        baseText = `Your glucose level of ${numVal} mg/dL is elevated compared to your fasting target of ${gMin}–${gMax} mg/dL. This fits the reading details where skipping breakfast can cause temporary glucose releases. Keep hydrated.`;
        tip = "Tip: Log post-meal glucose checks to see how physical activity affects your trends.";
      } else if (numVal < LOCAL_STATE.profile.glucoseHypoThreshold) {
        baseText = `Your glucose of ${numVal} mg/dL is below your critical warning threshold of ${LOCAL_STATE.profile.glucoseHypoThreshold} mg/dL. Eat 15g of fast carbs (like honey or fruit juice) now.`;
        tip = "Tip: Make sure you carry fast-acting glucose tablets when traveling.";
      } else {
        baseText = `Your fasting glucose of ${numVal} mg/dL is inside your clinical targets of ${gMin}–${gMax} mg/dL. Outstanding work keeping in range.`;
        tip = "Tip: Record the composition of your lunch today to evaluate glycemic stability.";
      }
    } else if (textLower.includes("bp") || textLower.includes("pressure") || text.includes("/")) {
      const bpMatch = text.match(/(\d{2,3})\/(\d{2,3})/);
      const sys = bpMatch ? parseInt(bpMatch[1]) : 138;
      const dia = bpMatch ? parseInt(bpMatch[2]) : 88;

      const sysMax = LOCAL_STATE.profile.bpSystolicTargetMax;
      const diaMax = LOCAL_STATE.profile.bpDiastolicTargetMax;

      if (sys >= sysMax || dia >= diaMax) {
        baseText = `Your BP reading of ${sys}/${dia} mmHg is elevated compared to your targeted clinical threshold of <${sysMax}/${diaMax} mmHg. Your classification indicates: ${LOCAL_STATE.profile.bpStage}. Resting is advised.`;
        tip = "Tip: Avoid heavy caffeine or sodium intake which can cause pressure spikes.";
      } else {
        baseText = `Your BP reading of ${sys}/${dia} mmHg is excellent and meets your target of <${sysMax}/${diaMax} mmHg. Continue with your prescriptions.`;
        tip = "Tip: Keep logging weekly pressure trends to share with your primary care provider.";
      }
    } else {
      baseText = `Thank you for logging your health readings. Keeping track of daily readings is critical for managing chronic conditions.`;
      tip = "Tip: Try logging your readings around the same time each morning.";
    }

    return `${baseText}\n\n${tip}\n\n${closing}`;
  }

  if (category === "[SYMPTOM]") {
    if (textLower.includes("dizzy") || textLower.includes("lightheaded")) {
      baseText = `Dizziness can be linked to drops in blood pressure or blood glucose, especially since you are taking Amlodipine 5mg. Please sit down in a comfortable chair immediately to prevent falls.`;
      tip = `Self-care step: Drink a glass of water and rest. What are your current blood pressure or blood sugar readings right now?`;
    } else if (textLower.includes("tired") || textLower.includes("fatigue")) {
      baseText = `Feeling tired or fatigued is common when blood sugar is fluctuating (like today's checkin of 178 mg/dL). Be sure to stay hydrated.`;
      tip = `Self-care step: Take a 20-minute rest and eat a high-fiber, balanced meal. Have you taken your Metformin dose today?`;
    } else if (textLower.includes("headache")) {
      baseText = `Headaches can occasionally occur with hypertension Stage classifications like your ${LOCAL_STATE.profile.bpStage}. Rest in a quiet, darkened room.`;
      tip = `Self-care step: Take your blood pressure reading now. Are you experiencing any blurred vision or nausea?`;
    } else {
      baseText = `I hear you're describing symptoms. Paying attention to physiological changes helps identify early triggers for diabetes and blood pressure shifts.`;
      tip = `Self-care step: Rest in a comfortable position. Can you describe when these symptoms began, and if they started before or after meals?`;
    }

    return `${baseText}\n\n${tip}\n\n${closing}`;
  }

  // [INFO] Category (Default)
  if (textLower.includes("miss") || textLower.includes("forgot") || textLower.includes("skip")) {
    baseText = `For missed Metformin, take it with food as soon as you remember, unless it is close to your next dose. In that case, skip it. Never double the dose.`;
    tip = "Tip: Try setting a daily recurring alarm or syncing with your breakfast schedule.";
  } else if (textLower.includes("eat") || textLower.includes("snack") || textLower.includes("diet") || textLower.includes("food")) {
    baseText = `Snacks for Type 2 diabetes should focus on high-fiber and protein to prevent glucose surges. Choose raw vegetables with hummus or a handful of almonds.`;
    tip = "Tip: Keep carbohydrate servings under 15 grams per snack to manage targets.";
  } else if (textLower.includes("metformin")) {
    baseText = `Metformin decreases liver glucose release and improves insulin sensitivity. Stomach upset is common initially; taking it with meals reduces this side effect.`;
    tip = "Tip: Contact your pharmacist if gastrointestinal side effects persist past two weeks.";
  } else if (textLower.includes("amlodipine")) {
    baseText = `Amlodipine relaxes blood vessels to lower pressure. It is typically taken once daily. Monitor for mild ankle swelling as a common side effect.`;
    tip = "Tip: Keep check-in logs of your blood pressure to assess efficacy.";
  } else {
    baseText = `I am here to help you manage and understand your Type 2 diabetes and hypertension. I can explain prescriptions, targets, symptoms, or healthy nutrition.`;
    tip = `Tip: Have questions prepared in a notebook for your next appointment with ${LOCAL_STATE.profile.physicianName}.`;
  }

  return `${baseText}\n\n${tip}\n\n${closing}`;
}

/* ----------------------------------------------------
   SAFETY OVERLAYS & GUARDRAIL COMPLIANCE
---------------------------------------------------- */

function triggerUrgentEmergencyOverlay(triggerText) {
  LOCAL_STATE.isUrgentState = true;

  // Insert critical alert into chat viewport
  const emergencyText = `🚨 [URGENT OVERRIDE]: Your message triggered keyword "${triggerText}".

This sounds like it may need urgent attention.
• If you are experiencing chest pain, difficulty breathing, numbness, or visual shifts, CALL 911 immediately.
• If glucose is below 54 mg/dL, eat 15g of fast-acting carbohydrates (juice, honey) now.

I have paused our conversation to ensure your safety. Confirm safety to resume.`;

  const assistantMsg = {
    sender: "assistant",
    text: emergencyText,
    timestamp: getCurrentTimeStr(),
    category: "[URGENT]"
  };
  
  addMessage(assistantMsg).then(() => {
    LOCAL_STATE.messages.push(assistantMsg);
    appendMessageBubble(assistantMsg);
    scrollToBottom();
  });

  // Prepare modal instructions
  if (triggerText.includes("glucose") || triggerText.includes("below 54")) {
    DOM.emergencyInstructionsText.innerHTML = `
      <strong>Severe Low Blood Sugar (Hypoglycemia) Protocol:</strong><br>
      1. Consume 15g of fast carbs immediately (4oz fruit juice, 3 glucose tablets, or 1 tbsp honey).<br>
      2. Wait 15 minutes, then check your blood sugar level.<br>
      3. If it remains under 70 mg/dL, repeat with another 15g of carbs.<br>
      4. Call 911 immediately if symptoms worsen or you feel faint.
    `;
  } else {
    DOM.emergencyInstructionsText.innerHTML = `
      <strong>Emergency Medical Protocol:</strong><br>
      1. Call 911 or have someone drive you to the nearest ER immediately.<br>
      2. Sit upright in a comfortable position; do not perform physical tasks.<br>
      3. Tell paramedics you are taking ${LOCAL_STATE.profile.medications} for ${LOCAL_STATE.profile.conditions}.
    `;
  }

  DOM.emergencyDialog.showModal();
}

function verifySafetyGuardrails(responseText) {
  const textLower = responseText.toLowerCase();

  // Rule 1: No new diagnosis
  const diagnoseKeywords = ["you have", "diagnose", "suffering from", "contracted", "developed", "disease", "illness is"];
  const hasDiagnosisViolation = diagnoseKeywords.some(keyword => textLower.includes(keyword) && !keyword.includes("diabetes"));

  // Rule 2: No dosage alterations
  const dosageKeywords = ["increase your", "decrease your", "stop taking", "double your", "change your dose", "take 1000mg", "take 10mg", "adjust metformin", "adjust amlodipine"];
  const hasDosageViolation = dosageKeywords.some(keyword => textLower.includes(keyword));

  // Word count check
  const wordCount = responseText.split(/\s+/).length;
  DOM.diagWordCount.textContent = `${wordCount} / 150 words`;

  // Render checklist icons
  updateSafetyChecklistItem(DOM.safetyItemDiagnosis, !hasDiagnosisViolation);
  updateSafetyChecklistItem(DOM.safetyItemDosage, !hasDosageViolation);
  updateSafetyChecklistItem(DOM.safetyItemWordcount, wordCount <= 165);
}

function updateSafetyChecklistItem(element, passed) {
  const icon = element.querySelector(".status-icon");
  if (passed) {
    element.classList.remove("violation");
    icon.textContent = "✅";
  } else {
    element.classList.add("violation");
    icon.textContent = "❌";
  }
}

/* ----------------------------------------------------
   AUTO-CHECKIN DIALOG TIMER
---------------------------------------------------- */

function triggerDailyAutoCheckin() {
  const summaryText = `Glucose: 155 mg/dL post-snack. Prescriptions taken: Metformin (morning/night). No active symptoms.`;
  const timeOfDay = getGreetingTime();

  const dailyPromptText = `Good ${timeOfDay}, ${LOCAL_STATE.profile.name}! Time for your daily check-in.

Based on yesterday's log, here's your summary:
• ${summaryText}

Please share today's readings when you have them:
- Fasting glucose (if applicable)
- How you're feeling (energy, mood)
- Any symptoms or concerns

I'll give you a quick assessment and today's tip.`;

  const newMsg = {
    sender: "assistant",
    text: dailyPromptText,
    timestamp: getCurrentTimeStr(),
    category: "[INFO]"
  };

  addMessage(newMsg).then(() => {
    LOCAL_STATE.messages.push(newMsg);
    appendMessageBubble(newMsg);
    scrollToBottom();
    updateDiagnosticsPanel("[INFO]", 0, "Daily checkin scheduler auto-trigger");
  });
}

/* ----------------------------------------------------
   PHYSICIAN REPORT EXPORTER (PRINTER)
---------------------------------------------------- */

function generateConsultationReport() {
  const p = LOCAL_STATE.profile;
  if (!p) return;

  const logsHTML = LOCAL_STATE.logs.map(log => `
    <tr>
      <td>${log.date}</td>
      <td>${log.glucose ? log.glucose + ' mg/dL' : '—'}</td>
      <td>${log.bp || '—'}</td>
      <td>${log.symptoms}</td>
      <td>${log.meal === 'yes' ? 'Yes' : log.meal === 'skipped' ? 'Skipped' : 'Heavy/High Carb'}</td>
    </tr>
  `).join("");

  const chatHTML = LOCAL_STATE.messages.slice(-5).map(msg => `
    <div class="report-chat-item ${msg.sender}">
      <div class="report-chat-meta">${msg.sender === "user" ? 'PATIENT' : 'ASSISTANT'} (${msg.timestamp} - ${msg.category || '[INFO]'})</div>
      <div>${msg.text}</div>
    </div>
  `).join("");

  DOM.reportPrintArea.innerHTML = `
    <div class="report-print-layout">
      <!-- Title & Branding -->
      <div class="report-section" style="border-bottom: 2px solid #0f172a;">
        <h1 style="font-family: var(--font-serif); margin-bottom: 4px;">ChronicCare Clinical Consultation Report</h1>
        <span style="font-size: 0.8rem; color: #64748b;">HIPAA Compliant Local Record • IndexedDB Source</span>
      </div>

      <!-- Demographics and Care Team -->
      <div class="report-section">
        <h3>📋 Patient Profile Details</h3>
        <div class="report-grid-2">
          <div class="report-field">
            <strong>Patient Name</strong>
            <span>${p.name}</span>
          </div>
          <div class="report-field">
            <strong>Chronic Conditions</strong>
            <span>${p.conditions}</span>
          </div>
          <div class="report-field">
            <strong>Active Prescriptions</strong>
            <span>${p.medications}</span>
          </div>
          <div class="report-field">
            <strong>Fasting Glucose Targets</strong>
            <span>${p.glucoseFastingTargetMin} – ${p.glucoseFastingTargetMax} mg/dL</span>
          </div>
          <div class="report-field">
            <strong>Postprandial Limit</strong>
            <span>&lt; ${p.glucosePostprandialMax} mg/dL</span>
          </div>
          <div class="report-field">
            <strong>Hypoglycemia Alert</strong>
            <span>&lt; ${p.glucoseHypoThreshold} mg/dL</span>
          </div>
          <div class="report-field">
            <strong>Blood Pressure Target</strong>
            <span>&lt; ${p.bpSystolicTargetMax}/${p.bpDiastolicTargetMax} mmHg (${p.bpStage})</span>
          </div>
          <div class="report-field">
            <strong>Primary Physician</strong>
            <span>${p.physicianName} (${p.physicianPhone})</span>
          </div>
        </div>
      </div>

      <!-- Log Readings Grid Table -->
      <div class="report-section">
        <h3>📊 7-Day Health Record Journal</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Glucose</th>
              <th>Blood Pressure</th>
              <th>Symptom Note</th>
              <th>Breakfast status</th>
            </tr>
          </thead>
          <tbody>
            ${logsHTML}
          </tbody>
        </table>
      </div>

      <!-- Chat Log extracts -->
      <div class="report-section">
        <h3>💬 Conversational Companion Summary</h3>
        <div class="report-chat-log">
          ${chatHTML}
        </div>
      </div>
    </div>
  `;

  document.getElementById("report-timestamp").textContent = `Generated on: ${new Date().toLocaleString()}`;
}

/* ----------------------------------------------------
   DATE & TIME HELPERS
---------------------------------------------------- */

function getFormattedTodayDate() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${month} ${day}`;
}

function getGreetingTime() {
  const hr = new Date().getHours();
  if (hr < 12) return "morning";
  if (hr < 17) return "afternoon";
  return "evening";
}

function getCurrentTimeStr() {
  const d = new Date();
  let hr = d.getHours();
  let min = d.getMinutes();
  if (hr < 10) hr = "0" + hr;
  if (min < 10) min = "0" + min;
  return `${hr}:${min}`;
}

// Boot up application
main();
