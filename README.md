# 🌿 ChronicCare Companion & Prompt Lab

A premium, portfolio-grade healthcare dashboard and AI prompt engineering diagnostic workspace. It features a custom, reassuring **Serene Bio-Organic theme** designed to feel therapeutic rather than flat and clinical, built entirely with modern semantic HTML5, custom vanilla CSS (with CSS variables and themes), and vanilla JS.

This is a **complete product** that integrates a patient-facing clinical logs tracker, interactive inline SVG charts, a digital pillbox, a compliance calendar, and a safety-critical chatbot with an engineering laboratory that compiles system instructions, analyzes classification rules, and logs safety violations in real time.

---

## 🚀 Key Features

### 1. Patient Health Hub
* **👤 Context Profile Panel**: Edit the patient's name, chronic conditions, active medications, and target guidelines. Changes instantly propagate to the compiled prompt.
* **💊 Digital Pillbox**: Track medication compliance. Click "Log" to take a pill, which updates next-dose count-down timers and syncs with the compliance logs.
* **📝 Daily Journal Logger**: Add daily blood glucose (mg/dL) and blood pressure readings.
* **📈 SVG Trend Analytics**: Interactive line charts for glucose and blood pressure over a 7-day period. Renders gridlines, target shaded bands, and points with rich hover titles.
* **🗓️ Compliance Calendar**: Track daily logging compliance. Colors indicate full log (meds + readings), partial log, or missed logging events.

### 2. Conversational Chat Companion
* **💬 Adaptive Chat Viewport**: Scrollable chat history with clear role avatars and response intent category badges.
* **🚀 Suggestion Chips**: Custom, dynamically populated seed prompts that match the active patient's conditions.
* **⏰ Daily Check-in Auto-message**: Simulates receiving the clinical check-in notification summarizing the patient's previous day.
* **🔒 API Gateway**: Insert your Google AI Studio Gemini API key to switch from simulated mock rules to live conversation with `gemini-1.5-flash` natively in the client.

### 3. Prompt Engineering Laboratory (Side Drawer)
* **🔍 System Prompt Compiler**: Visualizes the active raw system instruction template with real-time profile variable injections highlighted.
* **🔬 Classification diagnostics**: Displays detected intent (`[INFO]`, `[READING]`, `[SYMPTOM]`, `[URGENT]`), trigger keywords, and word count constraint metrics.
* **🛡️ Safety Guardrail Checklist**: Runs static checks on the chatbot's output to verify that it does not diagnose new conditions or adjust dosage schedules.

### 4. Safety Action Center
* **🚨 Emergency Keyword Override**: Typing escalation keywords (e.g. `chest pain`, `glucose below 54`) instantly locks the UI with a blurred overlay, showing critical clinical safety instructions.
* **🩺 Physician consultation Exporter**: Formats all log entries, active demographics, and recent chat logs into a printable clean layout.

---

## 🛠️ Tech Stack & Setup

* **Core**: Pure HTML5 (semantic elements like `<dialog>` and `<details>`) & Vanilla ES6+ JavaScript.
* **Styling**: Vanilla CSS with custom properties (CSS variables) for light, dark, and organic themes.
* **Fonts**: Fraunces (classic medical serif brand) & Outfit (sans-serif UI).
* **Dependencies**: None (fully self-contained, no frameworks required).

### Running Locally
To launch the application:
1. Open the `/home/deu/Coding Repos/Healthcare/index.html` file directly in any modern web browser.
2. Alternatively, run a simple local development server:
   ```bash
   # Using Python
   python3 -m http.server 8000
   
   # Or using Node/npx
   npx serve .
   ```

---

## 🧪 Quick Showcase Guide

Here is a workflow to demonstrate the product's features:

1. **Test the Organic Theme**: Click the **☀️ Light** or **🌒 Dark** buttons in the header to swap CSS stylesheets, then switch back to **🌿 Sage** to view the custom bio-organic theme.
2. **Log Today's Readings**: In the logger card, type `178` for Glucose and `138/88` for BP, then click **Record to Journal**. Note the SVG chart and calendar cell update instantly.
3. **Use the Digital Pillbox**: Click **Log** on the *Amlodipine* pill card. Today's cell on the compliance calendar will turn fully green (Full Log).
4. **Trigger URGENT overlay**: In the chat input, type `I am having sudden chest pain` and hit enter. The chat will lock and display emergency guidelines. Click **I have called for help** to dismiss it.
5. **Inspect Prompt Compilations**: Expand the **Prompt Lab** drawer. Update the patient name in the profile card from `Alex` to `Sarah`. Observe the system prompt display instantly highlighting `Sarah` inside the template.
6. **Live Gemini Test**: Add a Gemini API key. Ask `Can Metformin cause stomach aches?` to observe real-time, target-guided responses.
7. **Export Clinical Report**: Click **Generate Consultation Report** at the bottom of the lab panel, then print/save it.
