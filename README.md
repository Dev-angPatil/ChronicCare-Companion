# 🌿 ChronicCare Platform & Engineering Lab

An enterprise-grade patient care dashboard and AI prompt engineering diagnostics sandbox. Built entirely using a custom, therapeutic **Serene Bio-Organic theme** with Outfit/Fraunces typography and frosted glass animations. The application is completely serverless and runs client-side inside any modern browser, leveraging native web APIs.

This version features a modular **ES Module architecture** with robust local database stores, client-side linear regression analysis, a dynamic wellness gauge, voice control, hardware integrations, cryptographic security, and clinical logging.

---

## 🏗️ Technical Architecture & Modules

The application is structured into modular Javascript files loaded as ES6 modules in the browser:

* **[index.html](file:///home/deu/Coding%20Repos/Healthcare/index.html)** — Semantic HTML5 viewport skeleton implementing native `<dialog>` modals, `<details>` accordions, microphone inputs, and Bluetooth controllers.
* **[style.css](file:///home/deu/Coding%20Repos/Healthcare/style.css)** — Custom stylesheet detailing light/dark/organic variables, glowing microphone pulse animations, BLE terminal displays, and dynamic responsive adjustments.
* **[js/main.js](file:///home/deu/Coding%20Repos/Healthcare/js/main.js)** — Core bootstrapper and UI event listener coordinator, routing actions between state and presentation layers.
* **[js/state.js](file:///home/deu/Coding%20Repos/Healthcare/js/state.js)** — Local database controller managing **IndexedDB** (`ChronicCareDB` version 1) to persist patient profiles, digital pill schedules, logging journals, and chat timeline transcripts.
* **[js/analytics.js](file:///home/deu/Coding%20Repos/Healthcare/js/analytics.js)** — Statistical computation engine calculating the composite Wellness Score and running linear regressions over patient glucose and blood pressure logs.
* **[js/crypto.js](file:///home/deu/Coding%20Repos/Healthcare/js/crypto.js)** — Client-side cryptographic client implementing **AES-GCM** key derivation (via PBKDF2) to encrypt/decrypt Google Gemini API keys.
* **[js/classifier.js](file:///home/deu/Coding%20Repos/Healthcare/js/classifier.js)** — Intent parser classifying entries (`[URGENT]`, `[READING]`, `[SYMPTOM]`, `[INFO]`) and running regex routines to automatically extract logged metrics from conversational text.
* **[js/chart.js](file:///home/deu/Coding%20Repos/Healthcare/js/chart.js)** — SVG canvas drawing coordinates for glucose and blood pressure trends, shading clinical target zones in real time.
* **[js/speech.js](file:///home/deu/Coding%20Repos/Healthcare/js/speech.js)** — Audio capture client leveraging the **Web Speech API** (`webkitSpeechRecognition`) for voice dictation.
* **[js/bluetooth.js](file:///home/deu/Coding%20Repos/Healthcare/js/bluetooth.js)** — Pairing and data ingestion client simulating wireless Bluetooth blood sugar meters and pressure cuffs.

---

## 🚀 Key Features

### 1. Personalized Wellness Index
Displays a custom-drawn circular progress ring and score (0–100) representing patient wellness. The score calculates:
* Adherence rates of daily medications.
* Range compliance of fasting glucose logs.
* Target safety margins for blood pressure logs.
* Penalty adjustments for severe symptom warnings.

### 2. Proactive Clinical Insights (AI Trend Engine)
Performs linear regressions on 7-day health records to identify rising or falling blood sugar and pressure patterns.
* Triggers a card summarizing active clinical warnings (e.g. rising glucose trends, skipped breakfast hazards).
* Integrates active trends into the LLM context to feed-forward statistical analysis directly into the conversation.

### 3. NLP Log Autocreator
Open the Chat Companion and type:
> *"My blood sugar was 110 after lunch and my pressure is 125/82"*

* The parser extracts `Glucose: 110 mg/dL` and `BP: 125/82 mmHg` automatically.
* The readings are instantly logged to IndexedDB, updating the SVG chart and calendar activity dots.

### 4. Voice Speech Dictation
* Click the microphone button (`🎙️`) next to the chat bar.
* Speak your symptoms or readings.
* The final transcript is inserted directly into your chat input text box.

### 5. Bluetooth GATT Sync Simulation
* Click **🔌 BLE Sync** on the Log Readings card header.
* Click **Pair Glucometer** or **Pair BP Monitor**.
* The terminal logs device handshakes, connects services, reads simulated GATT characteristics, syncs the metric directly into your IndexedDB journal, and closes automatically.

### 6. Encrypted API Key Storage
* Paste your Gemini API key in the **Prompt Lab** sidebar.
* Enter a local passphrase and click **Encrypt & Save**. The key is saved as a secure AES-GCM ciphertext.
* Enter your passphrase and click **Decrypt & Load** to unlock live responses.

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
