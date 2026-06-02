/* ----------------------------------------------------
   INDEXEDDB PERSISTENCE MODULE (js/state.js)
---------------------------------------------------- */

const DB_NAME = "ChronicCareDB";
const DB_VERSION = 1;

let db = null;

// Seed Data for First-Time Users
const SEED_PROFILE = {
  name: "Alex",
  conditions: "Type 2 diabetes, hypertension",
  medications: "Metformin 500mg twice daily, Amlodipine 5mg",
  targets: "Fasting glucose: 80–130 mg/dL, Postprandial: <180 mg/dL, BP: <130/80 mmHg",
  checkin: "Glucose: 178 mg/dL, felt tired, skipped breakfast",
  
  // Advanced Clinical Settings
  glucoseFastingTargetMin: 80,
  glucoseFastingTargetMax: 130,
  glucosePostprandialMax: 180,
  glucoseHypoThreshold: 70,
  
  bpSystolicTargetMax: 130,
  bpDiastolicTargetMax: 80,
  bpStage: "Stage 1 Hypertension",
  
  physicianName: "Dr. Evelyn Ramirez",
  physicianPhone: "555-0147",
  physicianClinic: "Oakridge Primary Care Center"
};

const SEED_MEDICATIONS = [
  { id: "metformin", name: "Metformin", dose: "500mg", frequency: "Twice daily (Morning/Night)", taken: true, remainingHours: 8 },
  { id: "amlodipine", name: "Amlodipine", dose: "5mg", frequency: "Once daily (Morning)", taken: false, remainingHours: 0 }
];

const SEED_LOGS = [
  { date: "May 27", glucose: 110, bp: "125/82", meal: "yes", symptoms: "Feeling fine" },
  { date: "May 28", glucose: 145, bp: "128/84", meal: "yes", symptoms: "Mild headache" },
  { date: "May 29", glucose: 95, bp: "120/78", meal: "yes", symptoms: "Good energy" },
  { date: "May 30", glucose: 122, bp: "135/85", meal: "yes", symptoms: "Tired in evening" },
  { date: "May 31", glucose: 105, bp: "122/80", meal: "yes", symptoms: "None" },
  { date: "Jun 01", glucose: 155, bp: "130/82", meal: "yes", symptoms: "After heavy snack" },
  { date: "Jun 02", glucose: 178, bp: "138/88", meal: "skipped", symptoms: "Felt tired, skipped breakfast" }
];

const SEED_MESSAGES = [
  {
    sender: "assistant",
    text: "Good morning, Alex! Time for your daily check-in. Based on yesterday's log, you had a post-snack glucose of 155 mg/dL. Please share today's readings when you have them. I'll give you a quick assessment and today's tip.",
    timestamp: "08:15",
    category: "[INFO]"
  }
];

export function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB failed to open:", event);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const upgradeDb = event.target.result;

      // 1. Profile Store (simple key-value store)
      if (!upgradeDb.objectStoreNames.contains("profile")) {
        upgradeDb.createObjectStore("profile");
      }

      // 2. Logs Store (date is key)
      if (!upgradeDb.objectStoreNames.contains("logs")) {
        upgradeDb.createObjectStore("logs", { keyPath: "date" });
      }

      // 3. Medications Store (id is key)
      if (!upgradeDb.objectStoreNames.contains("medications")) {
        upgradeDb.createObjectStore("medications", { keyPath: "id" });
      }

      // 4. Chat Store (auto-incrementing index key)
      if (!upgradeDb.objectStoreNames.contains("chat")) {
        upgradeDb.createObjectStore("chat", { keyPath: "id", autoIncrement: true });
      }

      // Seed default items
      const transaction = event.target.transaction;
      
      const profileStore = transaction.objectStore("profile");
      profileStore.put(SEED_PROFILE, "patient");

      const medsStore = transaction.objectStore("medications");
      SEED_MEDICATIONS.forEach(med => medsStore.put(med));

      const logsStore = transaction.objectStore("logs");
      SEED_LOGS.forEach(log => logsStore.put(log));

      const chatStore = transaction.objectStore("chat");
      SEED_MESSAGES.forEach(msg => chatStore.put(msg));
    };
  });
}

/* ----------------------------------------------------
   STORE TRANSACTION WRAPPERS
---------------------------------------------------- */

// Profile operations
export function getProfile() {
  return new Promise((resolve, reject) => {
    const txn = db.transaction("profile", "readonly");
    const store = txn.objectStore("profile");
    const request = store.get("patient");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function setProfile(profile) {
  return new Promise((resolve, reject) => {
    const txn = db.transaction("profile", "readwrite");
    const store = txn.objectStore("profile");
    const request = store.put(profile, "patient");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Logs operations
export function getLogs() {
  return new Promise((resolve, reject) => {
    const txn = db.transaction("logs", "readonly");
    const store = txn.objectStore("logs");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function addLog(log) {
  return new Promise((resolve, reject) => {
    const txn = db.transaction("logs", "readwrite");
    const store = txn.objectStore("logs");
    const request = store.put(log);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Medications operations
export function getMedications() {
  return new Promise((resolve, reject) => {
    const txn = db.transaction("medications", "readonly");
    const store = txn.objectStore("medications");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function updateMedication(med) {
  return new Promise((resolve, reject) => {
    const txn = db.transaction("medications", "readwrite");
    const store = txn.objectStore("medications");
    const request = store.put(med);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Chat operations
export function getMessages() {
  return new Promise((resolve, reject) => {
    const txn = db.transaction("chat", "readonly");
    const store = txn.objectStore("chat");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function addMessage(msg) {
  return new Promise((resolve, reject) => {
    const txn = db.transaction("chat", "readwrite");
    const store = txn.objectStore("chat");
    const request = store.add(msg);
    request.onsuccess = () => resolve(request.result); // Resolves to new ID
    request.onerror = () => reject(request.error);
  });
}

export function clearMessages() {
  return new Promise((resolve, reject) => {
    const txn = db.transaction("chat", "readwrite");
    const store = txn.objectStore("chat");
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
