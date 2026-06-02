/* ----------------------------------------------------
   INTENT CLASSIFIER & NLP LOG PARSER (js/classifier.js)
---------------------------------------------------- */

// Escalation Keywords indicating a life-threatening clinical event
export const URGENT_KEYWORDS = [
  "chest pain", "can't breathe", "unconscious", "glucose below 54", 
  "severe headache", "blurred vision suddenly", "numbness in face", 
  "numbness in arm", "sweating profusely", "won't wake up", 
  "chest tightness", "shortness of breath", "fainted", "passed out",
  "difficulty breathing", "numb face", "slurred speech", "stroke"
];

/**
 * Classifies the patient message category based on safety triggers and context keywords.
 * Returns: { category: "[URGENT]" | "[READING]" | "[SYMPTOM]" | "[INFO]", trigger: string }
 */
export function classifyIntent(text) {
  const textLower = text.toLowerCase();

  // 1. Check URGENT Keywords
  for (const keyword of URGENT_KEYWORDS) {
    if (textLower.includes(keyword)) {
      return { category: "[URGENT]", trigger: keyword };
    }
  }

  // 2. Check for severe low blood glucose reading (hypoglycemia check)
  const glucoseRegex = /(?:glucose|sugar|reading)(?:\s+was|\s+is|\s+at)?\s+(\d{2,3})/i;
  const glucoseMatch = textLower.match(glucoseRegex);
  if (glucoseMatch) {
    const val = parseInt(glucoseMatch[1]);
    if (val < 54) {
      return { category: "[URGENT]", trigger: `glucose level (${val} mg/dL) below critical 54` };
    }
  }

  // 3. Check READING keywords
  const readingKeywords = ["glucose", "bp", "blood pressure", "reading", "sugar", "mg/dL", "numbers", "sys", "dia", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  if (readingKeywords.some(keyword => textLower.includes(keyword))) {
    return { category: "[READING]", trigger: "numeric/reading indicators" };
  }

  // 4. Check SYMPTOM keywords
  const symptomKeywords = ["feel", "feeling", "dizzy", "headache", "tired", "fatigue", "nausea", "pain", "cramp", "blurred", "ache", "weak", "shaky", "sweat", "vomit", "fever"];
  if (symptomKeywords.some(keyword => textLower.includes(keyword))) {
    return { category: "[SYMPTOM]", trigger: "symptom descriptors" };
  }

  // 5. Default Category
  return { category: "[INFO]", trigger: "general informational request" };
}

/**
 * Parses user speech/input text to extract health parameters automatically.
 * Enables natural language logging of readings: "glucose 120 and bp 130/80" -> { glucose: 120, bp: "130/80" }
 */
export function extractLogsFromText(text) {
  const textLower = text.toLowerCase();
  let extracted = {
    glucose: null,
    bp: null,
    symptom: null
  };

  // 1. Regex for Glucose: Match number following sugar, glucose, reading, is, at, was.
  // Handles formats: "glucose 120", "sugar is 95", "110 mg/dL", "glucose: 140"
  const glucosePatterns = [
    /(?:glucose|sugar|blood sugar)(?:\s+is|\s+was|\s+at|\s*:)?\s*(\d{2,3})/i,
    /(\d{2,3})\s*(?:mg\/dl|mg/dL)/i,
    /\b(\d{2,3})\b\s*(?:fasting|after breakfast|postprandial)/i
  ];

  for (const pattern of glucosePatterns) {
    const match = textLower.match(pattern);
    if (match) {
      const val = parseInt(match[1]);
      if (val >= 20 && val <= 600) { // Valid bounds check
        extracted.glucose = val;
        break;
      }
    }
  }

  // 2. Regex for Blood Pressure: Match format like "120/80" or "130 over 85"
  const bpPatterns = [
    /(\d{2,3})\s*\/\s*(\d{2,3})/,
    /(\d{2,3})\s+over\s+(\d{2,3})/i,
    /(?:bp|blood pressure)(?:\s+is|\s+was|\s+at|\s*:)?\s*(\d{2,3})\s*\/\s*(\d{2,3})/i
  ];

  for (const pattern of bpPatterns) {
    const match = textLower.match(pattern);
    if (match) {
      const sys = parseInt(match[1]);
      const dia = parseInt(match[2]);
      if (sys >= 60 && sys <= 250 && dia >= 30 && dia <= 150) { // Valid bounds check
        extracted.bp = `${sys}/${dia}`;
        break;
      }
    }
  }

  // 3. Extract basic symptom keyword if present
  const commonSymptoms = ["dizzy", "headache", "tired", "fatigue", "nausea", "weak", "shaky", "sweating"];
  for (const sym of commonSymptoms) {
    if (textLower.includes(sym)) {
      extracted.symptom = sym.charAt(0).toUpperCase() + sym.slice(1);
      break;
    }
  }

  return extracted;
}
