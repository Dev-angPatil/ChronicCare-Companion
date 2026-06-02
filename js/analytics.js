/* ----------------------------------------------------
   CLINICAL ANALYTICS & TREND ENGINE (js/analytics.js)
   ---------------------------------------------------- */

/**
 * Calculates a composite patient wellness score (0 to 100).
 * Weights:
 * - 40% Glucose logs within patient targets
 * - 30% Blood Pressure logs within systolic/diastolic targets
 * - 30% Medication adherence (fraction of taken prescriptions)
 */
export function computeWellnessScore(logs, medications, targets) {
  // Fallbacks if data is empty
  if (!logs || logs.length === 0) return 75; // Baseline default

  const gMin = targets.glucoseFastingTargetMin ?? 80;
  const gMax = targets.glucoseFastingTargetMax ?? 130;
  const bpSysMax = targets.bpSystolicTargetMax ?? 130;
  const bpDiaMax = targets.bpDiastolicTargetMax ?? 80;

  // 1. Glucose compliance check (last 7 logs)
  const glucoseLogs = logs.filter(l => l.glucose !== null);
  let glucoseInRangeCount = 0;
  glucoseLogs.forEach(l => {
    if (l.glucose >= gMin && l.glucose <= gMax) {
      glucoseInRangeCount++;
    }
  });
  const glucoseScore = glucoseLogs.length > 0 ? (glucoseInRangeCount / glucoseLogs.length) * 100 : 85;

  // 2. BP compliance check (last 7 logs)
  const bpLogs = logs.filter(l => l.bp !== null);
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
  const bpScore = bpLogs.length > 0 ? (bpInRangeCount / bpLogs.length) * 100 : 80;

  // 3. Medication adherence check
  let takenCount = 0;
  medications.forEach(m => {
    if (m.taken) takenCount++;
  });
  const medScore = medications.length > 0 ? (takenCount / medications.length) * 100 : 100;

  // 4. Symptom penalty (subtract 5 points for each log containing symptoms other than "none/fine")
  let symptomPenalty = 0;
  logs.forEach(l => {
    if (l.symptoms && l.symptoms.toLowerCase() !== "none" && l.symptoms.toLowerCase() !== "feeling fine" && l.symptoms.toLowerCase() !== "good energy" && l.symptoms.toLowerCase() !== "none reported" && l.symptoms.toLowerCase() !== "none reported.") {
      symptomPenalty += 3;
    }
  });

  // Calculate weighted score
  const rawScore = (glucoseScore * 0.4) + (bpScore * 0.3) + (medScore * 0.3) - symptomPenalty;
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

/**
 * Calculates the consecutive days logged.
 */
export function calculateStreak(logs, medications, todayStr) {
  let streak = 0;
  const todayLog = logs.find(l => l.date === todayStr);
  const medsAllTaken = medications.every(m => m.taken);
  
  const todayIsComplete = todayLog && medsAllTaken;
  let startOffset = 0;

  if (todayIsComplete) {
    streak = 1;
    startOffset = 1;
  } else {
    // If today is incomplete, start counting from yesterday
    startOffset = 1;
  }

  while (true) {
    const d = new Date();
    d.setDate(d.getDate() - (startOffset + streak));
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleDateString("en-US", { month: "short" });
    const formatted = `${month} ${day}`;

    const log = logs.find(l => l.date === formatted);
    // If there's a log, increment streak. 
    if (log) {
      streak++;
    } else {
      break;
    }

    if (streak > 30) break; // Limit safety check
  }

  return streak;
}

/**
 * Analyzes logs for clinical trends (linear regression/slope analysis).
 * Returns: {
 *   glucoseTrend: "stable" | "rising" | "falling" | "insufficient",
 *   glucoseSlope: number,
 *   bpTrend: "stable" | "rising" | "falling" | "insufficient",
 *   bpSlope: number,
 *   insights: string[]
 * }
 */
export function analyzeTrends(logs, targets) {
  const gMin = targets.glucoseFastingTargetMin ?? 80;
  const gMax = targets.glucoseFastingTargetMax ?? 130;
  const bpSysMax = targets.bpSystolicTargetMax ?? 130;

  const result = {
    glucoseTrend: "stable",
    glucoseSlope: 0,
    bpTrend: "stable",
    bpSlope: 0,
    insights: []
  };

  if (!logs || logs.length < 3) {
    result.insights.push("Continue logging for at least 3 days to reveal clinical trends.");
    return result;
  }

  // 1. Glucose trend calculation (linear regression)
  const glucoseData = logs
    .filter(l => l.glucose !== null)
    .map((l, index) => ({ x: index, y: l.glucose }));

  if (glucoseData.length >= 3) {
    const glucSlope = calculateSlope(glucoseData);
    result.glucoseSlope = parseFloat(glucSlope.toFixed(2));
    if (glucSlope > 4) {
      result.glucoseTrend = "rising";
      result.insights.push(`⚠️ Glucose shows a rising trend (+${result.glucoseSlope} mg/dL/day). Monitor carbohydrate intake and confirm morning medications.`);
    } else if (glucSlope < -4) {
      result.glucoseTrend = "falling";
      result.insights.push(`📉 Glucose shows a downward trend (${result.glucoseSlope} mg/dL/day). Verify you are eating adequate meals to prevent hypoglycemia.`);
    } else {
      result.glucoseTrend = "stable";
    }
  }

  // 2. BP Systolic trend calculation
  const bpData = logs
    .filter(l => l.bp !== null)
    .map((l, index) => {
      const sys = parseInt(l.bp.split("/")[0]);
      return { x: index, y: sys };
    });

  if (bpData.length >= 3) {
    const bpSlope = calculateSlope(bpData);
    result.bpSlope = parseFloat(bpSlope.toFixed(2));
    if (bpSlope > 2) {
      result.bpTrend = "rising";
      result.insights.push(`⚠️ Systolic blood pressure is on a rising trend (+${result.bpSlope} mmHg/day). Avoid excess sodium, manage stress, and log daily rests.`);
    } else if (bpSlope < -2) {
      result.bpTrend = "falling";
      result.insights.push(`📉 Systolic blood pressure shows a downward trend (${result.bpSlope} mmHg/day). Keep logging weekly trends.`);
    } else {
      result.bpTrend = "stable";
    }
  }

  // 3. Static checks / general health insights
  const lastLog = logs[logs.length - 1];
  if (lastLog) {
    if (lastLog.glucose > gMax) {
      result.insights.push("💡 Last glucose was above target. A brisk 15-minute walk can help lower blood sugar levels naturally.");
    }
    if (lastLog.bp) {
      const sys = parseInt(lastLog.bp.split("/")[0]);
      if (sys > bpSysMax) {
        result.insights.push("💡 Last blood pressure was elevated. Make sure to rest for 5 minutes in a quiet room before measuring.");
      }
    }
    if (lastLog.meal === "skipped") {
      result.insights.push("⚠️ Skipping breakfast can trigger liver glucose release, causing unexpected blood sugar spikes.");
    }
  }

  return result;
}

/**
 * Helper to calculate the slope of a simple linear regression
 */
function calculateSlope(points) {
  const n = points.length;
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
