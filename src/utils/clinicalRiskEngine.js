/* ----------------------------------------------------
   CLINICAL RISK & CORRELATION ENGINE (src/utils/clinicalRiskEngine.js)
   ---------------------------------------------------- */

/**
 * Calculates a composite patient wellness score (0 to 100).
 * Weights:
 * - 30% Medication adherence rate (daily taken prescriptions)
 * - 35% Glucose logs within patient targets
 * - 25% Blood Pressure logs within systolic/diastolic targets
 * - 10% Inverse symptom severity (fraction of symptom-free days)
 */
export function computeWellnessScore(logs, medications, targets) {
  if (!logs || logs.length === 0) return 75; // Baseline default

  const gMin = targets.glucoseFastingTargetMin ?? 80;
  const gMax = targets.glucoseFastingTargetMax ?? 130;
  const bpSysMax = targets.bpSystolicTargetMax ?? 130;
  const bpDiaMax = targets.bpDiastolicTargetMax ?? 80;

  // 1. Medication adherence
  let takenCount = 0;
  medications.forEach(m => {
    if (m.taken) takenCount++;
  });
  const medAdherence = medications.length > 0 ? (takenCount / medications.length) : 1.0;

  // 2. Glucose compliance
  const glucoseLogs = logs.filter(l => l.glucose !== null && l.glucose !== undefined);
  let glucoseInRangeCount = 0;
  glucoseLogs.forEach(l => {
    if (l.glucose >= gMin && l.glucose <= gMax) {
      glucoseInRangeCount++;
    }
  });
  const glucoseCompliance = glucoseLogs.length > 0 ? (glucoseInRangeCount / glucoseLogs.length) : 0.85;

  // 3. BP compliance
  const bpLogs = logs.filter(l => l.bp);
  let bpInRangeCount = 0;
  bpLogs.forEach(l => {
    const parts = l.bp.split("/");
    if (parts.length === 2) {
      const sys = parseInt(parts[0]);
      const dia = parseInt(parts[1]);
      if (sys <= bpSysMax && dia <= bpDiaMax) {
        bpInRangeCount++;
      }
    }
  });
  const bpCompliance = bpLogs.length > 0 ? (bpInRangeCount / bpLogs.length) : 0.80;

  // 4. Inverse symptom severity
  let symptomFreeCount = 0;
  logs.forEach(l => {
    const sym = l.symptoms ? l.symptoms.toLowerCase() : "";
    const isSymptomFree = !sym || 
                          sym.includes("none") || 
                          sym.includes("fine") || 
                          sym.includes("good") || 
                          sym.includes("stable");
    if (isSymptomFree) {
      symptomFreeCount++;
    }
  });
  const symptomScore = logs.length > 0 ? (symptomFreeCount / logs.length) : 0.90;

  const rawScore = (30 * medAdherence) + (35 * glucoseCompliance) + (25 * bpCompliance) + (10 * symptomScore);
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

/**
 * Calculates consecutive days logged
 */
export function calculateStreak(logs, medications, todayStr) {
  if (!logs || logs.length === 0) return 0;
  
  let streak = 0;
  const todayLog = logs.find(l => l.date === todayStr);
  const medsAllTaken = medications.length > 0 ? medications.every(m => m.taken) : true;
  
  const todayIsComplete = todayLog && medsAllTaken;
  let startOffset = 0;

  if (todayIsComplete) {
    streak = 1;
    startOffset = 1;
  } else {
    startOffset = 1;
  }

  while (true) {
    const d = new Date();
    d.setDate(d.getDate() - (startOffset + streak));
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleDateString("en-US", { month: "short" });
    const formatted = `${month} ${day}`;

    const log = logs.find(l => l.date === formatted);
    if (log) {
      streak++;
    } else {
      break;
    }

    if (streak > 30) break; 
  }

  return streak;
}

// Slope calculation helper for simple linear regression
function calculateSlope(points) {
  const n = points.length;
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += points[i].x;
    sumY += points[i].y;
    sumXY += points[i].x * points[i].y;
    sumXX += points[i].x * points[i].x;
  }

  const denominator = (n * sumXX) - (sumX * sumX);
  if (denominator === 0) return 0;
  
  return ((n * sumXY) - (sumX * sumY)) / denominator;
}

/**
 * Advanced Clinical Trend Analytics and Risk Forecasting Engine
 */
export function analyzeTrends(logs, targets) {
  const gMin = targets.glucoseFastingTargetMin ?? 80;
  const gMax = targets.glucoseFastingTargetMax ?? 130;
  const gHypo = targets.glucoseHypoThreshold ?? 70;
  const bpSysMax = targets.bpSystolicTargetMax ?? 130;
  const bpDiaMax = targets.bpDiastolicTargetMax ?? 80;

  const result = {
    glucoseTrend: "stable",
    glucoseSlope: 0,
    bpTrend: "stable",
    bpSlope: 0,
    alerts: [],
    correlations: [],
    insights: []
  };

  if (!logs || logs.length < 3) {
    result.insights.push("Continue logging for at least 3 days to reveal clinical trends.");
    return result;
  }

  // 1. Glucose Trend & 48-Hour Hypo/Hyper Forecast
  const glucoseLogs = logs.filter(l => l.glucose !== null && l.glucose !== undefined);
  const glucosePoints = glucoseLogs.map((l, idx) => ({ x: idx, y: l.glucose }));

  if (glucosePoints.length >= 3) {
    const gSlope = calculateSlope(glucosePoints);
    result.glucoseSlope = parseFloat(gSlope.toFixed(2));
    const lastGlucose = glucosePoints[glucosePoints.length - 1].y;

    if (gSlope > 5) {
      result.glucoseTrend = "rising";
      result.alerts.push(`⚠️ Glucose shows a rising trend (+${result.glucoseSlope} mg/dL/day). Monitor carbohydrate intake and confirm morning medications.`);
    } else if (gSlope < -5) {
      result.glucoseTrend = "falling";
      result.alerts.push(`📉 Glucose shows a downward trend (${result.glucoseSlope} mg/dL/day). Verify you are eating adequate meals to prevent hypoglycemia.`);
    }

    // Proactive 48-Hour Hypoglycemia Forecast
    if (gSlope < 0) {
      const daysToHypo = (gHypo - lastGlucose) / gSlope;
      if (daysToHypo > 0 && daysToHypo <= 2) {
        result.alerts.push(`⚠️ CRITICAL FORECAST: Downward glucose trajectory predicts hypoglycemia risk (<${gHypo} mg/dL) within ${Math.round(daysToHypo * 24)} hours. Ensure timely snacks and verify Metformin schedule.`);
      }
    }
  }

  // 2. BP Systolic Trend & Stage 2 Hypertension Forecast
  const bpLogs = logs.filter(l => l.bp);
  const bpPoints = bpLogs.map((l, idx) => {
    const sys = parseInt(l.bp.split("/")[0]);
    return { x: idx, y: sys };
  });

  if (bpPoints.length >= 3) {
    const bpSlope = calculateSlope(bpPoints);
    result.bpSlope = parseFloat(bpSlope.toFixed(2));
    const lastSys = bpPoints[bpPoints.length - 1].y;

    if (bpSlope > 2) {
      result.bpTrend = "rising";
      result.alerts.push(`⚠️ Systolic blood pressure is on a rising trend (+${result.bpSlope} mmHg/day). Limit sodium, manage stress, and log daily rests.`);
    } else if (bpSlope < -2) {
      result.bpTrend = "falling";
      result.alerts.push(`📉 Systolic blood pressure shows a downward trend (${result.bpSlope} mmHg/day).`);
    }

    // Proactive Stage 2 Hypertensive Forecast
    if (bpSlope > 0) {
      const daysToCrisis = (140 - lastSys) / bpSlope;
      if (daysToCrisis > 0 && daysToCrisis <= 2) {
        result.alerts.push(`⚠️ WARNING: Systolic blood pressure trajectory projects Stage 2 Hypertensive crisis (>140 mmHg) within ${Math.round(daysToCrisis * 24)} hours. Limit sodium and monitor closely.`);
      }
    }
  }

  // 3. Static checks
  const lastLog = logs[logs.length - 1];
  if (lastLog) {
    if (lastLog.glucose !== null && lastLog.glucose !== undefined) {
      if (lastLog.glucose < gHypo) {
        result.alerts.push(`🚨 CRITICAL LOW: Last glucose reading was ${lastLog.glucose} mg/dL (Hypoglycemia). Take 15g of fast-acting carbohydrates immediately and repeat in 15 minutes.`);
      } else if (lastLog.glucose > 180) {
        result.alerts.push(`⚠️ HYPERGLYCEMIA WARNING: Last glucose reading was high (${lastLog.glucose} mg/dL). Confirm insulin or Metformin compliance and drink plenty of water.`);
      }
    }
    if (lastLog.bp) {
      const [sys, dia] = lastLog.bp.split("/").map(Number);
      if (sys >= 140 || dia >= 90) {
        result.alerts.push(`🚨 HYPERTENSIVE STAGE 2 ALERT: Last blood pressure was ${lastLog.bp} mmHg. Rest for 5 minutes and repeat. If symptoms of headache, chest pain, or blurry vision persist, seek emergency care.`);
      }
    }
  }

  // 4. Advanced Correlation & Pattern Analytics
  // A. Dizziness / Low Sugar correlation
  const lowSugarDays = logs.filter(l => l.glucose !== null && l.glucose !== undefined && l.glucose < 90);
  const lowSugarDizzyDays = lowSugarDays.filter(l => {
    const sym = l.symptoms ? l.symptoms.toLowerCase() : "";
    return sym.includes("dizzy") || sym.includes("lighthead") || sym.includes("faint");
  });
  if (lowSugarDays.length >= 2 && lowSugarDizzyDays.length > 0) {
    const percent = Math.round((lowSugarDizzyDays.length / lowSugarDays.length) * 100);
    result.correlations.push(`🔍 CORRELATION DETECTED: Symptoms of dizziness occur in ${percent}% of logs with lower glucose levels (<90 mg/dL). Prioritize carrying glucose tablets.`);
  }

  // B. Headaches / High Systolic correlation
  const highSysDays = logs.filter(l => {
    if (!l.bp) return false;
    const sys = parseInt(l.bp.split("/")[0]);
    return sys > 130;
  });
  const highSysHeadacheDays = highSysDays.filter(l => {
    const sym = l.symptoms ? l.symptoms.toLowerCase() : "";
    return sym.includes("headache") || sym.includes("migraine") || sym.includes("blurry");
  });
  if (highSysDays.length >= 2 && highSysHeadacheDays.length > 0) {
    const percent = Math.round((highSysHeadacheDays.length / highSysDays.length) * 100);
    result.correlations.push(`🔍 CORRELATION DETECTED: Headache reports occur in ${percent}% of logs with elevated systolic BP (>130 mmHg). Report persistent headaches to Dr. Evelyn Ramirez.`);
  }

  // C. Breakfast Skipping Spike correlation
  const skippedBreakfastLogs = logs.filter(l => l.meal === "skipped");
  const skippedBreakfastGlucose = skippedBreakfastLogs.filter(l => l.glucose > 140);
  if (skippedBreakfastLogs.length >= 2 && skippedBreakfastGlucose.length > 0) {
    const percent = Math.round((skippedBreakfastGlucose.length / skippedBreakfastLogs.length) * 100);
    result.correlations.push(`🔍 PATTERN ALERT: Skipping breakfast correlates with glucose spikes (>140 mg/dL) in ${percent}% of instances. Consistent meal schedules are highly advised.`);
  }

  // D. General Health Tips
  if (lastLog) {
    if (lastLog.glucose > gMax && lastLog.glucose <= 180) {
      result.insights.push("💡 Last glucose was above target. A brisk 15-minute walk can help lower blood sugar levels naturally.");
    }
    if (lastLog.bp) {
      const [sys, dia] = lastLog.bp.split("/").map(Number);
      if (sys > bpSysMax && sys < 140) {
        result.insights.push("💡 Last blood pressure was elevated. Make sure to rest for 5 minutes in a quiet room before measuring.");
      }
    }
    if (lastLog.meal === "skipped" && !result.correlations.some(c => c.includes("breakfast"))) {
      result.insights.push("⚠️ Skipping breakfast can trigger liver glucose release, causing unexpected blood sugar spikes.");
    }
  }

  return result;
}
