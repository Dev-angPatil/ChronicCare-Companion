/* ----------------------------------------------------
   APPLICATION STATE & SEED DATA
---------------------------------------------------- */

const STATE = {
  profile: {
    name: "Alex",
    conditions: "Type 2 diabetes, hypertension",
    medications: "Metformin 500mg twice daily, Amlodipine 5mg",
    targets: "Fasting glucose: 80–130 mg/dL, BP: <130/80",
    checkin: "Glucose: 178 mg/dL, felt tired, skipped breakfast"
  },
  medications: [
    { id: "metformin", name: "Metformin", dose: "500mg", frequency: "Twice daily (Morning/Night)", taken: true, remainingHours: 8 },
    { id: "amlodipine", name: "Amlodipine", dose: "5mg", frequency: "Once daily (Morning)", taken: false, remainingHours: 0 }
  ],
  logs: [
    { date: "May 27", glucose: 110, bp: "125/82", meal: "yes", symptoms: "Feeling fine" },
    { date: "May 28", glucose: 145, bp: "128/84", meal: "yes", symptoms: "Mild headache" },
    { date: "May 29", glucose: 95, bp: "120/78", meal: "yes", symptoms: "Good energy" },
    { date: "May 30", glucose: 122, bp: "135/85", meal: "yes", symptoms: "Tired in evening" },
    { date: "May 31", glucose: 105, bp: "122/80", meal: "yes", symptoms: "None" },
    { date: "Jun 01", glucose: 155, bp: "130/82", meal: "yes", symptoms: "After heavy snack" },
    { date: "Jun 02", glucose: 178, bp: "138/88", meal: "skipped", symptoms: "Felt tired, skipped breakfast" }
  ],
  messages: [
    {
      sender: "assistant",
      text: "Good morning, Alex! Time for your daily check-in. Based on yesterday's log, you had a post-snack glucose of 155 mg/dL. Please share today's readings when you have them. I'll give you a quick assessment and today's tip.",
      timestamp: "08:15",
      category: "[INFO]"
    }
  ],
  activeChart: "glucose", // "glucose" | "bp"
  apiKey: localStorage.getItem("gemini_api_key") || "",
  isUrgentState: false,
  complianceStreak: 5
};

// Target bounds for clinical checks
const TARGETS = {
  glucoseMin: 80,
  glucoseMax: 130,
  bpSystolicMax: 130,
  bpDiastolicMax: 80
};

// System Prompt Template
const SYSTEM_PROMPT_TEMPLATE = `You are ChronicCare Companion, a supportive AI assistant for people managing chronic conditions like Type 2 diabetes, hypertension, and thyroid disorders. 

You help users understand their symptoms, medications, diet, and daily readings — but you are NOT a doctor. Always be warm, clear, and non-alarmist.

## USER PROFILE (injected at runtime)
- Name: {{user_name}}
- Condition(s): {{conditions}}
- Medications: {{medications}}
- Target ranges: {{targets}}
- Today's check-in: {{checkin}}

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

// Escalation Keywords
const URGENT_KEYWORDS = [
  "chest pain", "can't breathe", "unconscious", "glucose below 54", 
  "severe headache", "blurred vision suddenly", "numbness in face", 
  "numbness in arm", "sweating profusely", "won't wake up", 
  "chest tightness", "shortness of breath", "fainted", "passed out"
];

/* ----------------------------------------------------
   DOM ELEMENTS
---------------------------------------------------- */
const DOM = {
  themeBtns: document.querySelectorAll(".theme-btn"),
  quickPatientName: document.getElementById("quick-patient-name"),
  apiModeBadge: document.getElementById("api-mode-badge"),
  apiModeText: document.getElementById("api-mode-text"),
  togglePromptLab: document.getElementById("toggle-prompt-lab"),
  engineeringPanel: document.getElementById("engineering-panel"),
  
  // Profile Form
  profileForm: document.getElementById("profile-form"),
  profileName: document.getElementById("profile-name"),
  profileConditions: document.getElementById("profile-conditions"),
  profileMedications: document.getElementById("profile-medications"),
  profileTargets: document.getElementById("profile-targets"),
  
  // Pillbox
  pillGrid: document.getElementById("pill-grid"),
  medsTakenFraction: document.getElementById("meds-taken-fraction"),
  
  // Log Form
  logReadingsForm: document.getElementById("log-readings-form"),
  logGlucose: document.getElementById("log-glucose"),
  logBp: document.getElementById("log-bp"),
  logSymptom: document.getElementById("log-symptom"),
  logMeal: document.getElementById("log-meal"),
  
  // Charts
  trendTabBtns: document.querySelectorAll(".trend-tab-btn"),
  trendSvg: document.getElementById("trend-svg"),
  chartLegend: document.getElementById("chart-legend"),
  
  // Calendar & Streak
  calendarGrid: document.getElementById("calendar-grid"),
  streakCounter: document.getElementById("streak-counter"),
  
  // Chat
  chatViewport: document.getElementById("chat-viewport"),
  suggestionChips: document.getElementById("suggestion-chips"),
  chatInputForm: document.getElementById("chat-input-form"),
  chatTextarea: document.getElementById("chat-textarea"),
  btnDailyCheckin: document.getElementById("btn-daily-checkin"),
  
  // Prompt Lab
  geminiApiKey: document.getElementById("gemini-api-key"),
  btnToggleKeyVisibility: document.getElementById("btn-toggle-key-visibility"),
  btnSaveApiKey: document.getElementById("btn-save-api-key"),
  btnClearApiKey: document.getElementById("btn-clear-api-key"),
  liveSystemPrompt: document.getElementById("live-system-prompt"),
  diagDetectedIntent: document.getElementById("diag-detected-intent"),
  diagTriggerKeywords: document.getElementById("diag-trigger-keywords"),
  diagWordCount: document.getElementById("diag-word-count"),
  
  // Safety Items
  safetyItemDiagnosis: document.getElementById("safety-item-diagnosis"),
  safetyItemDosage: document.getElementById("safety-item-dosage"),
  safetyItemNonAlarmist: document.getElementById("safety-item-non-alarmist"),
  safetyItemWordcount: document.getElementById("safety-item-wordcount"),
  btnExportPhysician: document.getElementById("btn-export-physician"),
  
  // Modals
  emergencyDialog: document.getElementById("emergency-dialog"),
  emergencyInstructionsText: document.getElementById("emergency-instructions-text"),
  btnEmergencyConfirm: document.getElementById("btn-emergency-confirm"),
  reportDialog: document.getElementById("report-dialog"),
  reportPrintArea: document.getElementById("report-print-area"),
  btnCloseReport: document.getElementById("btn-close-report")
};

/* ----------------------------------------------------
   INIT & THEMES
---------------------------------------------------- */

function init() {
  setupEventListeners();
  updateThemeUI("organic");
  updateApiBadge();
  compileSystemPrompt();
  renderPillbox();
  renderCalendar();
  renderChart();
  renderChatHistory();
  populateSuggestionChips();
  
  // Set API key if saved
  if (STATE.apiKey) {
    DOM.geminiApiKey.value = STATE.apiKey;
  }
}

function setupEventListeners() {
  // Theme Switching
  DOM.themeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      DOM.themeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const theme = btn.dataset.theme;
      document.documentElement.setAttribute("data-theme", theme);
      updateThemeUI(theme);
    });
  });

  // Toggle Prompt Engineering Panel
  DOM.togglePromptLab.addEventListener("click", () => {
    DOM.engineeringPanel.classList.toggle("collapsed");
    DOM.togglePromptLab.classList.toggle("active");
    // Redraw chart since dimensions changed
    setTimeout(renderChart, 450);
  });

  // Profile Form Update
  DOM.profileForm.addEventListener("submit", (e) => {
    e.preventDefault();
    STATE.profile.name = DOM.profileName.value.trim();
    STATE.profile.conditions = DOM.profileConditions.value.trim();
    STATE.profile.medications = DOM.profileMedications.value.trim();
    STATE.profile.targets = DOM.profileTargets.value.trim();
    
    // Auto-update context
    document.getElementById("banner-patient-name").textContent = STATE.profile.name;
    document.getElementById("banner-patient-info").textContent = `${STATE.profile.conditions} • ${STATE.profile.medications.substring(0, 40)}...`;
    DOM.quickPatientName.textContent = STATE.profile.name;

    // Refresh dynamic prompt
    compileSystemPrompt();
    populateSuggestionChips();
    
    // Append small system event chat notification
    addSystemEventMessage(`Context profile updated for ${STATE.profile.name}.`);
  });

  // Log Readings Form Submit
  DOM.logReadingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const glucoseVal = DOM.logGlucose.value ? parseInt(DOM.logGlucose.value) : null;
    const bpVal = DOM.logBp.value.trim() || null;
    const symptomVal = DOM.logSymptom.value.trim() || "Felt good";
    const mealVal = DOM.logMeal.value;

    if (!glucoseVal && !bpVal) {
      alert("Please log at least one reading (Glucose or Blood Pressure).");
      return;
    }

    const todayLog = {
      date: getFormattedTodayDate(),
      glucose: glucoseVal,
      bp: bpVal,
      symptoms: symptomVal,
      meal: mealVal
    };

    // Update today's log in state or append
    const existingIndex = STATE.logs.findIndex(l => l.date === todayLog.date);
    if (existingIndex !== -1) {
      STATE.logs[existingIndex] = todayLog;
    } else {
      STATE.logs.push(todayLog);
      // Limit to 7 for visual trend
      if (STATE.logs.length > 7) {
        STATE.logs.shift();
      }
    }

    // Refresh calendar and charts
    renderCalendar();
    renderChart();
    
    // Clear Form inputs
    DOM.logGlucose.value = "";
    DOM.logBp.value = "";
    DOM.logSymptom.value = "";
    DOM.logMeal.value = "yes";

    // Set checkin state in profile
    STATE.profile.checkin = `Glucose: ${glucoseVal ? glucoseVal + ' mg/dL' : 'N/A'}, BP: ${bpVal || 'N/A'}, symptom note: ${symptomVal}, meal: ${mealVal}`;
    compileSystemPrompt();

    addSystemEventMessage("Daily readings added to medical journal.");
  });

  // Chart switching tab trigger
  DOM.trendTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      DOM.trendTabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.activeChart = btn.dataset.chart;
      renderChart();
    });
  });

  // Send Chat message
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

  // Daily Checkin click simulation
  DOM.btnDailyCheckin.addEventListener("click", () => {
    triggerDailyAutoCheckin();
  });

  // API Key management
  DOM.btnToggleKeyVisibility.addEventListener("click", () => {
    const isPass = DOM.geminiApiKey.type === "password";
    DOM.geminiApiKey.type = isPass ? "text" : "password";
    DOM.btnToggleKeyVisibility.textContent = isPass ? "🙈" : "👁️";
  });

  DOM.btnSaveApiKey.addEventListener("click", () => {
    const key = DOM.geminiApiKey.value.trim();
    STATE.apiKey = key;
    localStorage.setItem("gemini_api_key", key);
    updateApiBadge();
    alert("API Key connected. Chat companion is now running LIVE on Gemini 1.5 Flash.");
  });

  DOM.btnClearApiKey.addEventListener("click", () => {
    STATE.apiKey = "";
    DOM.geminiApiKey.value = "";
    localStorage.removeItem("gemini_api_key");
    updateApiBadge();
    alert("API Key removed. Switched to local Simulated Engine.");
  });

  // Emergency dialog confirmation
  DOM.btnEmergencyConfirm.addEventListener("click", () => {
    STATE.isUrgentState = false;
    DOM.emergencyDialog.close();
    addSystemEventMessage("Patient confirmed safe. Chat interface re-enabled.");
  });

  // Doctor Report print triggers
  DOM.btnExportPhysician.addEventListener("click", () => {
    generateReport();
    DOM.reportDialog.showModal();
  });

  DOM.btnCloseReport.addEventListener("click", () => {
    DOM.reportDialog.close();
  });

  // Fallback for light dismiss on native dialogs if unsupported
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    [DOM.emergencyDialog, DOM.reportDialog].forEach(dialog => {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (!isDialogContent) {
          // If emergency overlay, do not close without safety confirmation
          if (dialog === DOM.emergencyDialog) return;
          dialog.close();
        }
      });
    });
  }
}

function updateThemeUI(theme) {
  // Can adjust headers/icon states if needed based on active theme
}

function updateApiBadge() {
  const isLive = !!STATE.apiKey;
  DOM.apiModeBadge.className = `api-mode-badge ${isLive ? 'live' : 'simulated'}`;
  DOM.apiModeText.textContent = isLive ? "Live Gemini API" : "Simulated Engine";
}

/* ----------------------------------------------------
   PROMPT ENGINEERING LOGIC
---------------------------------------------------- */

function compileSystemPrompt() {
  let prompt = SYSTEM_PROMPT_TEMPLATE;
  
  // We want to highlight the injected variables in our Pre code
  const safeName = DOM.profileName.value.trim();
  const safeConditions = DOM.profileConditions.value.trim();
  const safeMedications = DOM.profileMedications.value.trim();
  const safeTargets = DOM.profileTargets.value.trim();
  const safeCheckin = STATE.profile.checkin;

  prompt = prompt.replace("{{user_name}}", safeName);
  prompt = prompt.replace("{{conditions}}", safeConditions);
  prompt = prompt.replace("{{medications}}", safeMedications);
  prompt = prompt.replace("{{targets}}", safeTargets);
  prompt = prompt.replace("{{checkin}}", safeCheckin);

  // In HTML element, display it with nice highlight spans
  let highlightedPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace("{{user_name}}", `<span class="prompt-highlight">${safeName}</span>`)
    .replace("{{conditions}}", `<span class="prompt-highlight">${safeConditions}</span>`)
    .replace("{{medications}}", `<span class="prompt-highlight">${safeMedications}</span>`)
    .replace("{{targets}}", `<span class="prompt-highlight">${safeTargets}</span>`)
    .replace("{{checkin}}", `<span class="prompt-highlight">${safeCheckin}</span>`);

  DOM.liveSystemPrompt.innerHTML = highlightedPrompt;
  return prompt; // Returns the raw compiled prompt for API calls
}

function getSystemInstructionsTextOnly() {
  // Compiles prompt without HTML tags
  return SYSTEM_PROMPT_TEMPLATE
    .replace("{{user_name}}", STATE.profile.name)
    .replace("{{conditions}}", STATE.profile.conditions)
    .replace("{{medications}}", STATE.profile.medications)
    .replace("{{targets}}", STATE.profile.targets)
    .replace("{{checkin}}", STATE.profile.checkin);
}

/* ----------------------------------------------------
   PILLBOX & COMPLIANCE STREAK
---------------------------------------------------- */

function renderPillbox() {
  DOM.pillGrid.innerHTML = "";
  let takenCount = 0;
  
  STATE.medications.forEach(med => {
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
      btn.addEventListener("click", () => logPillTaken(med.id));
      actionContainer.appendChild(btn);
    }

    item.appendChild(actionContainer);
    DOM.pillGrid.appendChild(item);
  });

  DOM.medsTakenFraction.textContent = `${takenCount}/${STATE.medications.length} Taken`;
  
  // If all medications are taken and readings are logged, calendar turns to full log
  updateStreakCompliance();
}

function logPillTaken(id) {
  const med = STATE.medications.find(m => m.id === id);
  if (med) {
    med.taken = true;
    renderPillbox();
    renderCalendar();
    addSystemEventMessage(`Logged medication dose: ${med.name} ${med.dose}.`);
  }
}

function updateStreakCompliance() {
  // Determine if checkin logs are completed for today
  const today = getFormattedTodayDate();
  const todayLog = STATE.logs.find(l => l.date === today);
  const medsAllTaken = STATE.medications.every(m => m.taken);

  if (todayLog && medsAllTaken) {
    STATE.complianceStreak = 6; // Seed streak was 5
  } else {
    STATE.complianceStreak = 5;
  }
  DOM.streakCounter.textContent = `🔥 ${STATE.complianceStreak} Day Streak`;
}

function renderCalendar() {
  DOM.calendarGrid.innerHTML = "";
  
  // Seed a static 14-day history calendar
  const todayNum = 2; // June 2nd
  
  for (let i = 20; i <= 31; i++) {
    // May days
    createDayNode(`May ${i}`, i, getDayStatus(`May ${i}`));
  }
  for (let i = 1; i <= 2; i++) {
    // June days
    const active = i === todayNum;
    createDayNode(`Jun 0${i}`, i, getDayStatus(`Jun 0${i}`), active);
  }
}

function createDayNode(fullDate, displayNum, status, active = false) {
  const day = document.createElement("div");
  day.className = `calendar-day ${status}-log ${active ? 'active' : ''}`;
  day.textContent = displayNum;
  day.title = `${fullDate}: ${status.toUpperCase()} Log`;
  DOM.calendarGrid.appendChild(day);
}

function getDayStatus(dateStr) {
  // Check if we have logs
  const log = STATE.logs.find(l => l.date === dateStr);
  const isToday = dateStr === getFormattedTodayDate();
  
  if (isToday) {
    const medsAllTaken = STATE.medications.every(m => m.taken);
    const hasLog = !!log;
    if (medsAllTaken && hasLog) return "full";
    if (medsAllTaken || hasLog) return "partial";
    return "none";
  }

  // Mock static historical status
  if (dateStr === "Jun 01") return "full";
  if (dateStr === "May 31") return "full";
  if (dateStr === "May 30") return "partial"; // missed some meds
  if (dateStr === "May 29") return "full";
  if (dateStr === "May 28") return "full";
  if (dateStr === "May 27") return "full";
  if (dateStr === "May 26") return "none"; // missed day
  
  return "full"; // default for other past days
}

/* ----------------------------------------------------
   SVG TREND CHARTS ENGINE
---------------------------------------------------- */

function renderChart() {
  const width = 500;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  DOM.trendSvg.innerHTML = "";

  const data = STATE.logs;
  if (!data || data.length === 0) return;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  if (STATE.activeChart === "glucose") {
    // Render Glucose Chart
    DOM.chartLegend.innerHTML = `
      <span class="legend-item target"><span class="legend-dot"></span> Target (80–130 mg/dL)</span>
      <span class="legend-item reading"><span class="legend-dot" style="background-color: var(--btn-primary-bg);"></span> Glucose Level</span>
    `;

    // Glucose ranges from 50 to 220
    const minVal = 50;
    const maxVal = 220;

    const getX = (index) => paddingLeft + (index / (data.length - 1)) * chartWidth;
    const getY = (val) => height - paddingBottom - ((val - minVal) / (maxVal - minVal)) * chartHeight;

    // Draw Grid Lines (Horizontal)
    const gridVals = [80, 130, 180];
    gridVals.forEach(g => {
      const y = getY(g);
      const line = createSVGLine(paddingLeft, y, width - paddingRight, y, "chart-grid-line");
      const text = createSVGText(paddingLeft - 8, y + 3, g, "chart-axis-text");
      text.setAttribute("text-anchor", "end");
      DOM.trendSvg.appendChild(line);
      DOM.trendSvg.appendChild(text);
    });

    // Draw Target Shaded Range (80 - 130)
    const targetY1 = getY(130);
    const targetY2 = getY(80);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", paddingLeft);
    rect.setAttribute("y", targetY1);
    rect.setAttribute("width", chartWidth);
    rect.setAttribute("height", targetY2 - targetY1);
    rect.setAttribute("class", "chart-target-range");
    DOM.trendSvg.appendChild(rect);

    // Plot Points and Draw Path
    let pathD = "";
    data.forEach((d, idx) => {
      if (d.glucose !== null) {
        const x = getX(idx);
        const y = getY(d.glucose);
        if (pathD === "") {
          pathD = `M ${x} ${y}`;
        } else {
          pathD += ` L ${x} ${y}`;
        }
      }
    });

    if (pathD !== "") {
      const linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      linePath.setAttribute("d", pathD);
      linePath.setAttribute("class", "chart-line chart-line-glucose");
      DOM.trendSvg.appendChild(linePath);
    }

    // Add Date Labels & Dots
    data.forEach((d, idx) => {
      const x = getX(idx);
      
      // Date X axis labels
      const dateText = createSVGText(x, height - 10, d.date, "chart-axis-text");
      dateText.setAttribute("text-anchor", "middle");
      DOM.trendSvg.appendChild(dateText);

      // Value dot
      if (d.glucose !== null) {
        const y = getY(d.glucose);
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", x);
        dot.setAttribute("cy", y);
        dot.setAttribute("r", "4.5");
        dot.setAttribute("class", "chart-dot chart-dot-glucose");
        
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${d.date}: ${d.glucose} mg/dL (${d.symptoms})`;
        dot.appendChild(title);
        DOM.trendSvg.appendChild(dot);
      }
    });

  } else {
    // Render Blood Pressure Chart (Systolic / Diastolic)
    DOM.chartLegend.innerHTML = `
      <span class="legend-item target"><span class="legend-dot"></span> Normal BP (<130/80)</span>
      <span class="legend-item reading"><span class="legend-dot" style="background-color: #c27f38;"></span> Sys / Dia</span>
    `;

    // BP ranges from 50 to 160
    const minVal = 50;
    const maxVal = 160;

    const getX = (index) => paddingLeft + (index / (data.length - 1)) * chartWidth;
    const getY = (val) => height - paddingBottom - ((val - minVal) / (maxVal - minVal)) * chartHeight;

    // Grid lines (80 for Diastolic, 130 for Systolic)
    const gridVals = [80, 120, 140];
    gridVals.forEach(g => {
      const y = getY(g);
      const line = createSVGLine(paddingLeft, y, width - paddingRight, y, "chart-grid-line");
      const text = createSVGText(paddingLeft - 8, y + 3, g, "chart-axis-text");
      text.setAttribute("text-anchor", "end");
      DOM.trendSvg.appendChild(line);
      DOM.trendSvg.appendChild(text);
    });

    // Plot Systolic Path & Diastolic Path
    let sysPathD = "";
    let diaPathD = "";

    data.forEach((d, idx) => {
      if (d.bp) {
        const [sys, dia] = d.bp.split("/").map(Number);
        const x = getX(idx);
        const ySys = getY(sys);
        const yDia = getY(dia);

        if (sysPathD === "") {
          sysPathD = `M ${x} ${ySys}`;
          diaPathD = `M ${x} ${yDia}`;
        } else {
          sysPathD += ` L ${x} ${ySys}`;
          diaPathD += ` L ${x} ${yDia}`;
        }
      }
    });

    if (sysPathD !== "") {
      const sysPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      sysPath.setAttribute("d", sysPathD);
      sysPath.setAttribute("class", "chart-line");
      sysPath.setAttribute("stroke", "#c27f38");
      DOM.trendSvg.appendChild(sysPath);

      const diaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      diaPath.setAttribute("d", diaPathD);
      diaPath.setAttribute("class", "chart-line");
      diaPath.setAttribute("stroke", "#5fa5b5");
      DOM.trendSvg.appendChild(diaPath);
    }

    // Add Dots
    data.forEach((d, idx) => {
      const x = getX(idx);
      
      const dateText = createSVGText(x, height - 10, d.date, "chart-axis-text");
      dateText.setAttribute("text-anchor", "middle");
      DOM.trendSvg.appendChild(dateText);

      if (d.bp) {
        const [sys, dia] = d.bp.split("/").map(Number);
        const ySys = getY(sys);
        const yDia = getY(dia);

        // Sys Dot
        const dotSys = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dotSys.setAttribute("cx", x);
        dotSys.setAttribute("cy", ySys);
        dotSys.setAttribute("r", "4");
        dotSys.setAttribute("class", "chart-dot");
        dotSys.setAttribute("stroke", "#c27f38");
        const titleSys = document.createElementNS("http://www.w3.org/2000/svg", "title");
        titleSys.textContent = `${d.date} Systolic: ${sys} mmHg`;
        dotSys.appendChild(titleSys);
        DOM.trendSvg.appendChild(dotSys);

        // Dia Dot
        const dotDia = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dotDia.setAttribute("cx", x);
        dotDia.setAttribute("cy", yDia);
        dotDia.setAttribute("r", "4");
        dotDia.setAttribute("class", "chart-dot");
        dotDia.setAttribute("stroke", "#5fa5b5");
        const titleDia = document.createElementNS("http://www.w3.org/2000/svg", "title");
        titleDia.textContent = `${d.date} Diastolic: ${dia} mmHg`;
        dotDia.appendChild(titleDia);
        DOM.trendSvg.appendChild(dotDia);
      }
    });
  }
}

function createSVGLine(x1, y1, x2, y2, className) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("class", className);
  return line;
}

function createSVGText(x, y, textContent, className) {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", x);
  text.setAttribute("y", y);
  text.setAttribute("class", className);
  text.textContent = textContent;
  return text;
}

/* ----------------------------------------------------
   CHAT SYSTEM
---------------------------------------------------- */

function renderChatHistory() {
  DOM.chatViewport.innerHTML = "";
  STATE.messages.forEach(msg => {
    appendMessageToUI(msg);
  });
  scrollToBottom();
}

function appendMessageToUI(msg) {
  const group = document.createElement("div");
  group.className = `chat-message-group ${msg.sender}`;

  const sender = document.createElement("span");
  sender.className = "chat-sender-label";
  sender.textContent = msg.sender === "user" ? STATE.profile.name : "Companion";

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.textContent = msg.text;

  // Add category badge to assistant responses
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

  group.appendChild(sender);
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

// Conversation starters dynamically loaded based on condition
const SUGGESTIONS_MAPPING = {
  "diabetes": [
    { label: "My glucose is high today", prompt: "My fasting glucose this morning was 178 mg/dL. Is that okay?" },
    { label: "Explain Metformin", prompt: "Can you explain what Metformin 500mg does and any side effects I should watch for?" },
    { label: "Healthy snack suggestion", prompt: "Can you suggest a good snack that won't spike my blood sugar?" }
  ],
  "hypertension": [
    { label: "I missed Amlodipine", prompt: "I forgot to take my Amlodipine 5mg this morning. What should I do?" },
    { label: "I feel dizzy today", prompt: "I've been feeling dizzy for the past hour. Could this be related to my blood pressure or diabetes?" }
  ]
};

function populateSuggestionChips() {
  DOM.suggestionChips.innerHTML = "";
  
  // Find matches based on conditions
  const conditionsLower = STATE.profile.conditions.toLowerCase();
  let selectedSuggestions = [];

  if (conditionsLower.includes("diabet")) {
    selectedSuggestions.push(...SUGGESTIONS_MAPPING["diabetes"]);
  }
  if (conditionsLower.includes("hyperten") || conditionsLower.includes("pressure")) {
    selectedSuggestions.push(...SUGGESTIONS_MAPPING["hypertension"]);
  }

  // Fallbacks if no match
  if (selectedSuggestions.length === 0) {
    selectedSuggestions = [
      { label: "Check my readings", prompt: "I have recorded my health readings for today. Can you give me an assessment?" },
      { label: "General dietary tip", prompt: "Can you give me a simple healthy dietary recommendation for general wellness?" }
    ];
  }

  selectedSuggestions.forEach(item => {
    const chip = document.createElement("button");
    chip.className = "suggestion-chip";
    chip.textContent = item.label;
    chip.addEventListener("click", () => {
      DOM.chatTextarea.value = item.prompt;
      DOM.chatTextarea.focus();
    });
    DOM.suggestionChips.appendChild(chip);
  });
}

function triggerDailyAutoCheckin() {
  const timeOfDay = getGreetingTime();
  const summaryText = `Glucose: 155 mg/dL after a snack. Meds taken: Metformin (morning/night). No active symptoms.`;

  const dailyPromptText = `Good ${timeOfDay}, ${STATE.profile.name}! Time for your daily check-in.

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

  STATE.messages.push(newMsg);
  appendMessageToUI(newMsg);
  scrollToBottom();
  
  // Update classifier diagnostics
  updateClassifierDiagnostics("[INFO]", 0, "Daily checkin scheduler auto-trigger");
}

/* ----------------------------------------------------
   CLASSIFIER, SAFETY & RESPONSE ORCHESTRATION
---------------------------------------------------- */

function classifyIntent(text) {
  const textLower = text.toLowerCase();
  
  // 1. Check URGENT Keywords
  for (const keyword of URGENT_KEYWORDS) {
    if (textLower.includes(keyword)) {
      return { category: "[URGENT]", trigger: keyword };
    }
  }

  // Check custom blood glucose numeric triggers (e.g. "glucose was 45" or "sugar is 50")
  const glucoseRegex = /(?:glucose|sugar|reading)(?:\s+was|\s+is|\s+at)?\s+(\d{2,3})/i;
  const match = textLower.match(glucoseRegex);
  if (match) {
    const val = parseInt(match[1]);
    if (val < 54) {
      return { category: "[URGENT]", trigger: `glucose level (${val} mg/dL) below 54` };
    }
  }

  // 2. Check READING
  const readingKeywords = ["glucose", "bp", "blood pressure", "reading", "sugar", "mg/dL", "numbers", "sys", "dia", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  if (readingKeywords.some(keyword => textLower.includes(keyword))) {
    return { category: "[READING]", trigger: "numeric/reading keywords detected" };
  }

  // 3. Check SYMPTOM
  const symptomKeywords = ["feel", "feeling", "dizzy", "headache", "tired", "fatigue", "nausea", "pain", "cramp", "blurred", "ache", "weak", "shaky", "sweat"];
  if (symptomKeywords.some(keyword => textLower.includes(keyword))) {
    return { category: "[SYMPTOM]", trigger: "symptom/feeling keywords detected" };
  }

  // 4. Default to INFO
  return { category: "[INFO]", trigger: "general informational request" };
}

async function handleUserSendMessage(text) {
  if (!text) return;

  // Add User Message to State & UI
  const userMsg = {
    sender: "user",
    text: text,
    timestamp: getCurrentTimeStr()
  };
  STATE.messages.push(userMsg);
  appendMessageToUI(userMsg);
  DOM.chatTextarea.value = "";
  scrollToBottom();

  // Classify input
  const classification = classifyIntent(text);
  updateClassifierDiagnostics(classification.category, text.split(/\s+/).length, classification.trigger);

  // If URGENT category
  if (classification.category === "[URGENT]") {
    triggerUrgentAction(classification.trigger);
    return;
  }

  // Show typing indicator
  const typingIndicator = showTypingIndicator();

  try {
    let responseText = "";
    if (STATE.apiKey) {
      // Connect to real Gemini API
      responseText = await callGeminiAPI(text, classification.category);
    } else {
      // Run Simulated response
      responseText = generateSimulatedResponse(text, classification.category);
    }

    // Remove typing indicator and append response
    typingIndicator.remove();

    const assistantMsg = {
      sender: "assistant",
      text: responseText,
      timestamp: getCurrentTimeStr(),
      category: classification.category
    };
    STATE.messages.push(assistantMsg);
    appendMessageToUI(assistantMsg);
    scrollToBottom();

    // Verify response through guardrail checks
    verifyGuardrails(responseText);

  } catch (err) {
    typingIndicator.remove();
    console.error("API Call error: ", err);
    
    // Fallback response on error
    const fallbackMsg = {
      sender: "assistant",
      text: "I experienced a connection issue. Here is a simulated response:\n\n" + generateSimulatedResponse(text, classification.category),
      timestamp: getCurrentTimeStr(),
      category: classification.category
    };
    STATE.messages.push(fallbackMsg);
    appendMessageToUI(fallbackMsg);
    scrollToBottom();
  }
}

function updateClassifierDiagnostics(category, userWordCount, triggerText) {
  DOM.diagDetectedIntent.className = `diag-value badge ${category.replace("[", "").replace("]", "").toLowerCase()}`;
  DOM.diagDetectedIntent.textContent = category;
  DOM.diagTriggerKeywords.textContent = triggerText;
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

/* ----------------------------------------------------
   REAL GEMINI API CALL CONNECTOR
---------------------------------------------------- */

async function callGeminiAPI(userText, detectedCategory) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${STATE.apiKey}`;

  // Build the message history context
  const systemInstruction = getSystemInstructionsTextOnly();
  
  // Format message history for Gemini structure
  const formattedHistory = [];
  
  // Limit conversation logs passed to save tokens
  const recentMessages = STATE.messages.slice(-6); 

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
      temperature: 0.35
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
    throw new Error(`Gemini API Error: Status ${response.status}`);
  }

  const responseData = await response.json();
  if (responseData.candidates && responseData.candidates[0].content.parts[0].text) {
    return responseData.candidates[0].content.parts[0].text.trim();
  } else {
    throw new Error("Empty candidate response from Gemini API");
  }
}

/* ----------------------------------------------------
   SIMULATED RESPONSE GENERATOR
---------------------------------------------------- */

function generateSimulatedResponse(text, category) {
  const textLower = text.toLowerCase();
  let baseText = "";
  let tip = "";
  let closing = `You are doing a wonderful job checking in, ${STATE.profile.name}!`;

  if (category === "[READING]") {
    // Determine number value if present
    const numbers = text.match(/\d+/g);
    const numVal = numbers ? parseInt(numbers[0]) : 178;

    if (textLower.includes("glucose") || textLower.includes("sugar")) {
      if (numVal > TARGETS.glucoseMax) {
        baseText = `Your glucose reading of ${numVal} mg/dL is higher than your target fasting range of 80–130 mg/dL. This is common when fasting breakfast is skipped, which can stimulate hepatic glucose production. Make sure to log details on heavy food items.`;
        tip = "Tip: Try taking a gentle 15-minute walk after meals to help naturally stabilize blood glucose.";
      } else if (numVal < TARGETS.glucoseMin) {
        baseText = `Your glucose reading of ${numVal} mg/dL is below your target fasting range of 80–130 mg/dL. Please eat 15g of fast carbs immediately if you feel shaky, sweating, or lightheaded.`;
        tip = "Tip: Keep glucose tablets or juice nearby at all times to address low blood sugar events.";
      } else {
        baseText = `Your glucose reading of ${numVal} mg/dL is perfectly within your personal target range of 80–130 mg/dL. Keep up the excellent dietary tracking and medication adherence.`;
        tip = "Tip: Log what you ate for dinner yesterday to see how it affected today's reading.";
      }
    } else if (textLower.includes("bp") || textLower.includes("pressure") || text.includes("/")) {
      const bpMatch = text.match(/(\d{2,3})\/(\d{2,3})/);
      const sys = bpMatch ? parseInt(bpMatch[1]) : 138;
      const dia = bpMatch ? parseInt(bpMatch[2]) : 88;

      if (sys >= 130 || dia >= 80) {
        baseText = `Your blood pressure reading of ${sys}/${dia} mmHg is elevated relative to your clinical target of <130/80 mmHg. Stress, high sodium intake, or missing medication can trigger elevated pressures. Avoid strenuous actions immediately.`;
        tip = "Tip: Sit quietly for 5 minutes and repeat the measurement to confirm accuracy.";
      } else {
        baseText = `Your blood pressure reading of ${sys}/${dia} mmHg is excellent and meets your clinical target of <130/80 mmHg. Continue taking Amlodipine regularly as scheduled.`;
        tip = "Tip: Reduce dietary sodium intake by choosing fresh over processed foods.";
      }
    } else {
      baseText = `Thank you for sharing your reading of ${numVal}. Based on your profile target ranges, checking your glucose and blood pressure consistently helps track therapy compliance.`;
      tip = "Tip: Try logging your readings at the same time each day for clean records.";
    }

    return `${baseText}\n\n${tip}\n\n${closing}`;
  }

  if (category === "[SYMPTOM]") {
    if (textLower.includes("dizzy") || textLower.includes("lightheaded")) {
      baseText = "Feeling dizzy can be connected to changes in your blood pressure or blood sugar. Since you are taking Amlodipine 5mg and Metformin, a drop in pressure or glucose could be causing this. Please sit down in a safe chair immediately to prevent falls.";
      tip = "Self-care step: Have a small glass of water or juice and rest. Could you check your current glucose or BP reading and share it with me?";
    } else if (textLower.includes("tired") || textLower.includes("fatigue")) {
      baseText = "Feeling tired or fatigued is a common symptom when blood sugars are fluctuating, such as today's reading of 178 mg/dL, or if blood pressure is higher than normal. Ensure you stay well-hydrated throughout the morning.";
      tip = "Self-care step: Take a rest period and aim to eat a balanced, fiber-rich lunch. Have you taken your Metformin dose as scheduled today?";
    } else if (textLower.includes("headache")) {
      baseText = "Headaches can sometimes be a symptom of elevated blood pressure, especially since your targets are <130/80 mmHg. Rest in a quiet, dark room if possible.";
      tip = "Self-care step: Measure your blood pressure right now. Did the headache start suddenly, and are you experiencing any changes in vision?";
    } else {
      baseText = "I notice you are describing a symptom. Acknowledging changes in how you feel is vital for managing Type 2 diabetes and hypertension. Please rest and monitor your state closely.";
      tip = "Self-care step: Write down when this symptom started. Can you describe if you feel this more after meals or after taking medication?";
    }

    return `${baseText}\n\n${tip}\n\n${closing}`;
  }

  // [INFO] Category (Default)
  if (textLower.includes("miss") || textLower.includes("forgot") || textLower.includes("skip")) {
    baseText = "If you forget a dose of Metformin, take it with food as soon as you remember. However, if it's almost time for your next dose, skip the missed one and continue your normal schedule. Never take two doses at once to make up for a missed one.";
    tip = "Tip: Link taking your pills with daily habits, like brushing your teeth or eating breakfast.";
  } else if (textLower.includes("eat") || textLower.includes("snack") || textLower.includes("food") || textLower.includes("diet")) {
    baseText = "A healthy snack option for managing Type 2 diabetes should combine fiber and protein to prevent glucose spikes. Great options include a small handful of almonds, celery sticks with hummus, or plain Greek yogurt.";
    tip = "Tip: Try reading nutrition labels to keep carbohydrate servings under 15g per snack.";
  } else if (textLower.includes("metformin")) {
    baseText = "Metformin helps lower blood glucose by improving the way your body handles insulin and reducing the amount of sugar your liver makes. Common side effects include mild stomach discomfort when starting, which is reduced by taking it with meals.";
    tip = "Tip: Make sure to monitor for rare side effects and check in with your pharmacist.";
  } else if (textLower.includes("amlodipine")) {
    baseText = "Amlodipine is a calcium channel blocker that relaxes blood vessels, helping lower blood pressure. It is typically taken once daily. Watch for mild ankle swelling or dizziness as potential side effects.";
    tip = "Tip: Try checking your blood pressure at home weekly to see if Amlodipine is keeping you in range.";
  } else {
    baseText = "I'm here to provide education and resources on managing diabetes and hypertension. I can explain medications, targets, symptoms, or healthy foods. Please consult your physician for changes to your clinical routine.";
    tip = "Tip: Keep a notebook of health questions to bring to your next doctor's appointment.";
  }

  return `${baseText}\n\n${tip}\n\n${closing}`;
}

/* ----------------------------------------------------
   SAFETY OVERRIDES & GUARDRAIL CHECKS
---------------------------------------------------- */

function triggerUrgentAction(triggerWord) {
  STATE.isUrgentState = true;

  // Render urgent message in chat
  const urgentText = `🚨 [URGENT DETECTED]: Your message mentions "${triggerWord}".

This sounds like it may need urgent attention.
• If you are experiencing chest pain, shortness of breath, sudden numbness, or blurred vision, please CALL 911 (or local emergency services) immediately.
• If your glucose is below 54 mg/dL, eat 15g of fast-acting carbs (juice, honey, candy) now.

I have paused our chat session. Please confirm your safety to resume.`;

  const assistantMsg = {
    sender: "assistant",
    text: urgentText,
    timestamp: getCurrentTimeStr(),
    category: "[URGENT]"
  };
  STATE.messages.push(assistantMsg);
  appendMessageToUI(assistantMsg);
  scrollToBottom();

  // Populate overlay dialog content
  if (triggerWord.includes("glucose") || triggerWord.includes("below 54")) {
    DOM.emergencyInstructionsText.innerHTML = `
      <strong>Low Blood Sugar (Hypoglycemia) Protocol:</strong><br>
      1. Eat or drink 15 grams of fast-acting carbs (e.g., 4 ounces of juice, 3-4 glucose tablets).<br>
      2. Wait 15 minutes, then check your blood sugar again.<br>
      3. If it remains below 70 mg/dL, repeat with another 15g of carbs.<br>
      4. Call 911 if you feel confused, faint, or symptoms worsen.
    `;
  } else {
    DOM.emergencyInstructionsText.innerHTML = `
      <strong>Emergency Medical Protocol:</strong><br>
      1. CALL 911 immediately or have someone drive you to the nearest Emergency Room.<br>
      2. Sit upright in a comfortable position; do not perform physical tasks.<br>
      3. Keep your phone near you and prepare to list your medications (Metformin, Amlodipine) for the paramedics.
    `;
  }

  // Trigger modal
  DOM.emergencyDialog.showModal();
}

function verifyGuardrails(response) {
  const textLower = response.toLowerCase();
  
  // Rule 1: No new diagnosis
  const diagnoseKeywords = ["you have", "diagnose", "suffering from", "contracted", "developed", "disease", "illness is"];
  let hasDiagnosisViolation = diagnoseKeywords.some(keyword => textLower.includes(keyword) && !keyword.includes("diabetes")); // Ignore seeded conditions

  // Rule 2: No dosage alterations
  const dosageKeywords = ["increase your", "decrease your", "stop taking", "double your", "change your dose", "take 1000mg", "take 10mg", "adjust metformin", "adjust amlodipine"];
  let hasDosageViolation = dosageKeywords.some(keyword => textLower.includes(keyword));

  // Word count check
  const wordCount = response.split(/\s+/).length;
  DOM.diagWordCount.textContent = `${wordCount} / 150 words`;

  // Toggle checklist UI
  updateChecklistItem(DOM.safetyItemDiagnosis, !hasDiagnosisViolation);
  updateChecklistItem(DOM.safetyItemDosage, !hasDosageViolation);
  updateChecklistItem(DOM.safetyItemWordcount, wordCount <= 165); // 150 limits + buffer
}

function updateChecklistItem(el, passed) {
  const icon = el.querySelector(".status-icon");
  if (passed) {
    el.classList.remove("violation");
    icon.textContent = "✅";
  } else {
    el.classList.add("violation");
    icon.textContent = "❌";
  }
}

/* ----------------------------------------------------
   REPORTS EXPORTER (PDF/PRINT)
---------------------------------------------------- */

function generateReport() {
  const logsHTML = STATE.logs.map(log => `
    <tr>
      <td>${log.date}</td>
      <td>${log.glucose ? log.glucose + ' mg/dL' : '—'}</td>
      <td>${log.bp || '—'}</td>
      <td>${log.symptoms}</td>
      <td>${log.meal === 'yes' ? 'Yes' : log.meal === 'skipped' ? 'Skipped' : 'Heavy/High Carb'}</td>
    </tr>
  `).join("");

  const chatHTML = STATE.messages.slice(-5).map(msg => `
    <div class="report-chat-item ${msg.sender}">
      <div class="report-chat-meta">${msg.sender === "user" ? 'PATIENT' : 'ASSISTANT'} (${msg.timestamp} - ${msg.category || '[INFO]'})</div>
      <div>${msg.text}</div>
    </div>
  `).join("");

  DOM.reportPrintArea.innerHTML = `
    <div class="report-print-layout">
      <div class="report-section">
        <h3>📋 Patient Profile Context</h3>
        <div class="report-grid-2">
          <div class="report-field">
            <strong>Patient Name</strong>
            <span>${STATE.profile.name}</span>
          </div>
          <div class="report-field">
            <strong>Conditions</strong>
            <span>${STATE.profile.conditions}</span>
          </div>
          <div class="report-field">
            <strong>Medications List</strong>
            <span>${STATE.profile.medications}</span>
          </div>
          <div class="report-field">
            <strong>Clinical Target Guidelines</strong>
            <span>${STATE.profile.targets}</span>
          </div>
        </div>
      </div>

      <div class="report-section">
        <h3>📊 7-Day Clinical Reading Records</h3>
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

      <div class="report-section">
        <h3>💬 Recent Conversational Logs</h3>
        <div class="report-chat-log">
          ${chatHTML}
        </div>
      </div>
    </div>
  `;
  document.getElementById("report-timestamp").textContent = `Generated on: ${new Date().toLocaleString()}`;
}

/* ----------------------------------------------------
   HELPERS & DATE MANAGEMENT
---------------------------------------------------- */

function getFormattedTodayDate() {
  return "Jun 02"; // Match current seeded today log
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

// Start Application on Load
window.addEventListener("DOMContentLoaded", init);
