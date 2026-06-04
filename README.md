# ChronicCare Companion v2.0 (Clinical-Grade Roster & Patient Portal)

ChronicCare Companion is a state-of-the-art web application designed to empower patients managing chronic diseases and foster secure, measurement-based collaboration with their primary care physicians.

Built using the **Pinterest Design System** aesthetic (warm-cream theme, `#e60023` brand red, 16px/32px rounded corners, quiet layouts), the platform incorporates clinical protocols for five major chronic conditions:
1. **Diabetes**: Fasting Blood Glucose tracking (standard targets: 80-130 mg/dL).
2. **Hypertension**: Systolic and Diastolic Blood Pressure monitoring (target: <130/80 mmHg).
3. **Anxiety**: Generalized Anxiety Disorder-7 (GAD-7) clinical scoring (0-21 scale) and resting Heart Rate (bpm).
4. **Asthma**: Peak Expiratory Flow (PEF, L/min) and rescue inhaler puff tracking.
5. **Chronic Pain**: Numerical Rating Scale (NRS) pain intensity mapping (0-10 scale).

---

## 🌟 Core Features

*   **Adaptive Condition-Sensitive UI**: Onboarding wizard checkboxes configure which metrics are tracked. The daily vitals form, historical charts, and logs list dynamically adapt to show only relevant fields.
*   **Dual-Database Reliability**: Dual compatibility with local **SQLite** (for easy fallback and local development) and **Supabase PostgreSQL** (production cloud deployment).
*   **Clinical Risk & Forecast Engine**: Utilizes mathematical **Linear Regression Slope analysis** on historical telemetry to predict 48-hour risk windows (e.g., hypoglycemia, hypertensive crisis, declining peak flow).
*   **Unified AI Clinical Companion**: An interactive chatbot primed with evidence-based disease guidelines. Handles clinical questions, parses logged metrics, maps correlations, and suggests self-management techniques.
*   **Web Bluetooth Telemetry Sync**: Supports simulated Web Bluetooth syncing for Omron BP cuffs and Accu-Chek smart glucometers.
*   **Mutual Consent Physician Linking**: Restricts physician access to patient logs until explicitly approved by the patient via a secure opt-in invitation flow.
*   **Local Adherence Notifications**: Native browser Notification API alerts reminding users to complete their daily logs and check off prescription adherence.
*   **Export to CSV**: Downloadable clinical reports for physician consultations.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### 1. Start the Backend API
Navigate to the root directory and start the Node Express server. It will automatically detect local SQLite configuration or Supabase variables in `server/.env`.
```bash
node server/index.js
```
The server will start on `http://localhost:5000` with the SQLite database file initialized at `server/chronic_care.db`.

### 2. Start the React Frontend
In a new terminal window in the root directory, start the Vite development server:
```bash
npm run dev
```
Open your browser to `http://localhost:5173`.

---

## 📂 Project Architecture

- `/src/components`: Front-end views, including the PWA Landing Page, Onboarding Wizard, Patient Dashboard Grid, and Physician Portal.
- `/src/utils`: Client-side API fetch abstraction (`db.js`).
- `/server/index.js`: Node Express REST API routing and JWT session validation.
- `/server/db.js`: Database driver translating queries between SQLite syntax and Postgres syntax.
- `/server/analysis.js`: Server-side clinical forecasting and statistical correlation mapping.
- `/OVERVIEW.md`: Detailed engineering architecture.
- `/SOLUTION.md`: Clinical problems solved by the platform.
