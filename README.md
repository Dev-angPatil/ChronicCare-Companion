# 🌿 ChronicCare Platform & Engineering Lab

An enterprise-grade patient care dashboard and AI prompt engineering diagnostics sandbox. Built entirely using a custom, therapeutic **Serene Bio-Organic theme** with Outfit/Fraunces typography and frosted glass animations. The application is completely serverless and runs client-side inside any modern browser, leveraging native web APIs.

This version transitions the codebase into a modular, production-ready **ES Module architecture** with robust local database stores, hardware integrations, cryptographic security, and clinical logging.

---

## 🏗️ Technical Architecture & Modules

The application is structured into modular Javascript files loaded as ES6 modules in the browser:

* **[index.html](file:///home/deu/Coding%20Repos/Healthcare/index.html)** — Semantic HTML5 viewport skeleton implementing native `<dialog>` modals, `<details>` accordions, microphone inputs, and Bluetooth controllers.
* **[style.css](file:///home/deu/Coding%20Repos/Healthcare/style.css)** — Custom stylesheet detailing light/dark/organic variables, glowing microphone pulse animations, BLE terminal displays, and dynamic responsive adjustments.
* **[js/main.js](file:///home/deu/Coding%20Repos/Healthcare/js/main.js)** — Core bootstrapper and UI event listener coordinator, routing actions between state and presentation layers.
* **[js/state.js](file:///home/deu/Coding%20Repos/Healthcare/js/state.js)** — Local database controller managing **IndexedDB** (`ChronicCareDB` version 1) to persist patient profiles, digital pill schedules, logging journals, and chat timeline transcripts.
* **[js/crypto.js](file:///home/deu/Coding%20Repos/Healthcare/js/crypto.js)** — Client-side cryptographic client implementing **AES-GCM** key derivation (via PBKDF2) to encrypt/decrypt Google Gemini API keys.
* **[js/classifier.js](file:///home/deu/Coding%20Repos/Healthcare/js/classifier.js)** — Intent parser classifying entries (`[URGENT]`, `[READING]`, `[SYMPTOM]`, `[INFO]`) and running regex routines to automatically extract logged metrics from conversational text.
* **[js/chart.js](file:///home/deu/Coding%20Repos/Healthcare/js/chart.js)** — SVG canvas drawing coordinates for glucose and blood pressure trends, shading clinical target zones in real time.
* **[js/speech.js](file:///home/deu/Coding%20Repos/Healthcare/js/speech.js)** — Audio capture client leveraging the **Web Speech API** (`webkitSpeechRecognition`) for voice dictation.
* **[js/bluetooth.js](file:///home/deu/Coding%20Repos/Healthcare/js/bluetooth.js)** — Pairing and data ingestion client simulating wireless Bluetooth blood sugar meters and pressure cuffs.

---

## 🚀 Key Feature Demos

### 1. Advanced Clinical Profile
Click the **Detailed Clinical Profile** card in the left panel to expand:
* **Diabetes Targets**: Customize Fasting Range limits (e.g. 80-130 mg/dL), Postprandial Max limits, and Hypoglycemia warning thresholds. The SVG trend chart immediately updates its shaded target zones based on these settings.
* **Hypertension Stages**: Set targets and select classification stages (e.g. Stage 1 vs Stage 2 Hypertension).
* **Physician Directories**: Update your primary doctor's name, telephone number, and clinic. All data is dynamically compiled into the companion's active system prompt instruction.

### 2. NLP Log Autocreator
Open the Chat Companion and type:
> *"My blood sugar was 110 after lunch and my pressure is 125/82"*

Confirm that:
* The parser extracts `Glucose: 110 mg/dL` and `BP: 125/82 mmHg` automatically.
* The readings are instantly logged to IndexedDB, updating the 7-day SVG chart and calendar activity dots.
* The system logs a `[NLP LOG EXTRACTED]` system event notification inside the chat history.

### 3. Voice Speech Dictation
* Click the microphone button (`🎙️`) next to the chat bar.
* Speak your symptoms or readings.
* The final transcript is inserted directly into your chat input text box.

### 4. Bluetooth GATT Sync Simulation
* Click **🔌 BLE Sync** on the Log Readings card header.
* Click **Pair Glucometer** or **Pair BP Monitor**.
* The terminal logs device handshakes, connects services, reads simulated GATT characteristics, syncs the metric directly into your IndexedDB journal, and closes automatically.

### 5. Encrypted API Key Storage
* Paste your Gemini API key in the **Prompt Lab** sidebar.
* Enter a local passphrase and click **Encrypt & Save**. The key is saved as a secure AES-GCM ciphertext colon-separated hex format.
* To chat, type your passphrase and click **Decrypt & Load** to unlock live responses.

---

## 🛠️ Launching the Platform

To open the application locally:
```bash
# Start a local HTTP server
python3 -m http.server 8000

# Or serve via Node
npx serve .
```
Visit `http://localhost:8000` inside Google Chrome, Safari, or Microsoft Edge.
