/* ----------------------------------------------------
   SERVER-SIDE CLINICAL RISK FORECAST ENGINE (server/analysis.js)
   ---------------------------------------------------- */

/**
 * Calculates wellness score (0 to 100) based on DB records.
 */
export function computeWellnessScore(logs, medications, targets) {
  if (!logs || logs.length === 0) return 75; // baseline default

  const gMin = targets.glucoseFastingTargetMin ?? 80;
  const gMax = targets.glucoseFastingTargetMax ?? 130;
  const bpSysMax = targets.bpSystolicTargetMax ?? 130;
  const bpDiaMax = targets.bpDiastolicTargetMax ?? 80;

  let totalWeight = 0;
  let weightedSum = 0;

  // 1. Medication adherence
  if (medications && medications.length > 0) {
    let takenCount = 0;
    medications.forEach(m => {
      if (m.taken === 1 || m.taken === true) takenCount++;
    });
    const medAdherence = takenCount / medications.length;
    weightedSum += medAdherence * 30;
    totalWeight += 30;
  }

  // 2. Glucose compliance
  const glucoseLogs = logs.filter(l => l.glucose !== null && l.glucose !== undefined);
  if (glucoseLogs.length > 0) {
    let glucoseInRangeCount = 0;
    glucoseLogs.forEach(l => {
      if (l.glucose >= gMin && l.glucose <= gMax) glucoseInRangeCount++;
    });
    weightedSum += (glucoseInRangeCount / glucoseLogs.length) * 35;
    totalWeight += 35;
  }

  // 3. BP compliance
  const bpLogs = logs.filter(l => l.bp_systolic !== null && l.bp_diastolic !== null && l.bp_systolic !== undefined && l.bp_diastolic !== undefined);
  if (bpLogs.length > 0) {
    let bpInRangeCount = 0;
    bpLogs.forEach(l => {
      if (l.bp_systolic <= bpSysMax && l.bp_diastolic <= bpDiaMax) bpInRangeCount++;
    });
    weightedSum += (bpInRangeCount / bpLogs.length) * 25;
    totalWeight += 25;
  }

  // 4. Anxiety (GAD-7) compliance: score < 10 (minimal/mild symptoms)
  const anxietyLogs = logs.filter(l => l.anxiety_level !== null && l.anxiety_level !== undefined);
  if (anxietyLogs.length > 0) {
    let anxietyComplianceCount = 0;
    anxietyLogs.forEach(l => {
      if (l.anxiety_level < 10) anxietyComplianceCount++;
    });
    weightedSum += (anxietyComplianceCount / anxietyLogs.length) * 25;
    totalWeight += 25;
  }

  // 5. Heart rate compliance: 60 to 100 bpm
  const hrLogs = logs.filter(l => l.heart_rate !== null && l.heart_rate !== undefined);
  if (hrLogs.length > 0) {
    let hrComplianceCount = 0;
    hrLogs.forEach(l => {
      if (l.heart_rate >= 60 && l.heart_rate <= 100) hrComplianceCount++;
    });
    weightedSum += (hrComplianceCount / hrLogs.length) * 15;
    totalWeight += 15;
  }

  // 6. Peak flow compliance: >= 350 L/min
  const peakFlowLogs = logs.filter(l => l.peak_flow !== null && l.peak_flow !== undefined);
  if (peakFlowLogs.length > 0) {
    let peakFlowComplianceCount = 0;
    peakFlowLogs.forEach(l => {
      if (l.peak_flow >= 350) peakFlowComplianceCount++;
    });
    weightedSum += (peakFlowComplianceCount / peakFlowLogs.length) * 25;
    totalWeight += 25;
  }

  // 7. Inhaler puffs compliance: <= 2 puffs/day
  const inhalerLogs = logs.filter(l => l.inhaler_puffs !== null && l.inhaler_puffs !== undefined);
  if (inhalerLogs.length > 0) {
    let inhalerComplianceCount = 0;
    inhalerLogs.forEach(l => {
      if (l.inhaler_puffs <= 2) inhalerComplianceCount++;
    });
    weightedSum += (inhalerComplianceCount / inhalerLogs.length) * 15;
    totalWeight += 15;
  }

  // 8. Pain level compliance: pain level < 5
  const painLogs = logs.filter(l => l.pain_level !== null && l.pain_level !== undefined);
  if (painLogs.length > 0) {
    let painComplianceCount = 0;
    painLogs.forEach(l => {
      if (l.pain_level < 5) painComplianceCount++;
    });
    weightedSum += (painComplianceCount / painLogs.length) * 25;
    totalWeight += 25;
  }

  // 9. Symptoms compliance
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
  weightedSum += (symptomFreeCount / logs.length) * 10;
  totalWeight += 10;

  if (totalWeight === 0) return 75;
  return Math.max(0, Math.min(100, Math.round((weightedSum / totalWeight) * 100)));
}

/**
 * Calculates logging streak based on date presence in logs.
 */
export function calculateStreak(logs, medications, todayStr) {
  if (!logs || logs.length === 0) return 0;
  
  let streak = 0;
  const todayLog = logs.find(l => l.date === todayStr);
  const medsAllTaken = medications.length > 0 ? medications.every(m => m.taken === 1 || m.taken === true) : true;
  
  const todayIsComplete = todayLog && medsAllTaken;
  let startOffset = 0;

  if (todayIsComplete) {
    streak = 1;
    startOffset = 1;
  } else {
    startOffset = 1;
  }

  let offset = startOffset;
  while (true) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleDateString("en-US", { month: "short" });
    const formatted = `${month} ${day}`;

    const log = logs.find(l => l.date === formatted);
    if (log) {
      streak++;
      offset++;
    } else {
      break;
    }

    if (streak > 30) break; 
  }

  return streak;
}

// Linear regression slope helper
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
 * Performs clinical risk predictions and logs correlation analysis.
 */
export function analyzeTrends(logs, targets) {
  const gMin = targets.glucoseFastingTargetMin ?? 80;
  const gMax = targets.glucoseFastingTargetMax ?? 130;
  const gHypo = targets.glucoseHypoThreshold ?? 70;
  const bpSysMax = targets.bpSystolicTargetMax ?? 130;

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

  // 1. Glucose slope and 48-Hour Hypo warning
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

    if (gSlope < 0) {
      const daysToHypo = (gHypo - lastGlucose) / gSlope;
      if (daysToHypo > 0 && daysToHypo <= 2) {
        result.alerts.push(`⚠️ CRITICAL FORECAST: Downward glucose trajectory predicts hypoglycemia risk (<${gHypo} mg/dL) within ${Math.round(daysToHypo * 24)} hours. Ensure timely snacks.`);
      }
    }
  }

  // 2. BP Systolic Trend & 48-Hour Hypertension crisis alert
  const bpLogs = logs.filter(l => l.bp_systolic !== null && l.bp_systolic !== undefined);
  const bpPoints = bpLogs.map((l, idx) => ({ x: idx, y: l.bp_systolic }));

  if (bpPoints.length >= 3) {
    const bpSlope = calculateSlope(bpPoints);
    result.bpSlope = parseFloat(bpSlope.toFixed(2));
    const lastSys = bpPoints[bpPoints.length - 1].y;

    if (bpSlope > 2) {
      result.bpTrend = "rising";
      result.alerts.push(`⚠️ Systolic blood pressure is on a rising trend (+${result.bpSlope} mmHg/day). Limit sodium and manage stress.`);
    } else if (bpSlope < -2) {
      result.bpTrend = "falling";
      result.alerts.push(`📉 Systolic blood pressure shows a downward trend (${result.bpSlope} mmHg/day).`);
    }

    if (bpSlope > 0) {
      const daysToCrisis = (140 - lastSys) / bpSlope;
      if (daysToCrisis > 0 && daysToCrisis <= 2) {
        result.alerts.push(`⚠️ WARNING: Systolic blood pressure trajectory projects Stage 2 Hypertensive crisis (>140 mmHg) within ${Math.round(daysToCrisis * 24)} hours.`);
      }
    }
  }

  // 2.5 Anxiety, Heart Rate, Peak Flow, and Pain Slopes
  const anxietyLogs = logs.filter(l => l.anxiety_level !== null && l.anxiety_level !== undefined);
  const anxietyPoints = anxietyLogs.map((l, idx) => ({ x: idx, y: l.anxiety_level }));
  if (anxietyPoints.length >= 3) {
    const anxSlope = calculateSlope(anxietyPoints);
    if (anxSlope > 0.5) {
      result.alerts.push(`⚠️ Anxiety levels (GAD-7) show a rising trend (+${anxSlope.toFixed(2)}/day). Consider breathing exercises or contacting support.`);
    }
  }

  const peakFlowLogs = logs.filter(l => l.peak_flow !== null && l.peak_flow !== undefined);
  const peakFlowPoints = peakFlowLogs.map((l, idx) => ({ x: idx, y: l.peak_flow }));
  if (peakFlowPoints.length >= 3) {
    const pfSlope = calculateSlope(peakFlowPoints);
    if (pfSlope < -10) {
      result.alerts.push(`🚨 CRITICAL ASTHMA FORECAST: Peak expiratory flow shows a steep decline (${pfSlope.toFixed(2)} L/min/day). High risk of asthma flare-up.`);
    }
  }

  const painLogs = logs.filter(l => l.pain_level !== null && l.pain_level !== undefined);
  const painPoints = painLogs.map((l, idx) => ({ x: idx, y: l.pain_level }));
  if (painPoints.length >= 3) {
    const painSlope = calculateSlope(painPoints);
    if (painSlope > 0.5) {
      result.alerts.push(`⚠️ Pain levels show a rising trajectory (+${painSlope.toFixed(2)}/day). Limit strenuous tasks and consult pain care protocols.`);
    }
  }

  // 3. Static Threshold Alerts
  const lastLog = logs[logs.length - 1];
  if (lastLog) {
    if (lastLog.glucose !== null && lastLog.glucose !== undefined) {
      if (lastLog.glucose < gHypo) {
        result.alerts.push(`🚨 CRITICAL LOW: Last glucose reading was ${lastLog.glucose} mg/dL (Hypoglycemia). Take 15g of fast-acting carbohydrates immediately.`);
      } else if (lastLog.glucose > 180) {
        result.alerts.push(`⚠️ HYPERGLYCEMIA WARNING: Last glucose reading was high (${lastLog.glucose} mg/dL). Confirm medication compliance and drink water.`);
      }
    }
    if (lastLog.bp_systolic !== null && lastLog.bp_diastolic !== null) {
      if (lastLog.bp_systolic >= 140 || lastLog.bp_diastolic >= 90) {
        result.alerts.push(`🚨 HYPERTENSIVE ALERT: Last blood pressure was ${lastLog.bp_systolic}/${lastLog.bp_diastolic} mmHg. Rest for 5 minutes and repeat.`);
      }
    }
    if (lastLog.anxiety_level !== null && lastLog.anxiety_level !== undefined) {
      if (lastLog.anxiety_level >= 15) {
        result.alerts.push(`🚨 SEVERE ANXIETY ALERT: Your last logged anxiety score was ${lastLog.anxiety_level}/21 (Severe). Practice slow breathing and contact your healthcare companion.`);
      } else if (lastLog.anxiety_level >= 10) {
        result.alerts.push(`⚠️ MODERATE ANXIETY warning: Last anxiety level was ${lastLog.anxiety_level}/21. Consider active stress relief or mindfulness exercises.`);
      }
    }
    if (lastLog.heart_rate !== null && lastLog.heart_rate !== undefined) {
      if (lastLog.heart_rate > 100) {
        result.alerts.push(`⚠️ TACHYCARDIA WARNING: Elevated resting heart rate detected (${lastLog.heart_rate} bpm). Rest and monitor.`);
      } else if (lastLog.heart_rate < 50) {
        result.alerts.push(`⚠️ BRADYCARDIA WARNING: Low resting heart rate detected (${lastLog.heart_rate} bpm). Consult a physician if symptomatic.`);
      }
    }
    if (lastLog.peak_flow !== null && lastLog.peak_flow !== undefined) {
      if (lastLog.peak_flow < 350) {
        result.alerts.push(`🚨 ASTHMA CRISIS ALERT: Last peak flow of ${lastLog.peak_flow} L/min is in the red zone. Use your rescue inhaler immediately.`);
      } else if (lastLog.peak_flow < 450) {
        result.alerts.push(`⚠️ ASTHMA WARNING: Peak flow is in the yellow zone (${lastLog.peak_flow} L/min). Monitor breathing closely.`);
      }
    }
    if (lastLog.inhaler_puffs !== null && lastLog.inhaler_puffs !== undefined) {
      if (lastLog.inhaler_puffs > 2) {
        result.alerts.push(`⚠️ EXCESSIVE INHALER USE: You logged ${lastLog.inhaler_puffs} puffs of rescue inhaler. High frequency indicates poor airway control.`);
      }
    }
    if (lastLog.pain_level !== null && lastLog.pain_level !== undefined) {
      if (lastLog.pain_level >= 7) {
        result.alerts.push(`🚨 SEVERE PAIN ALERT: Pain intensity is severe (${lastLog.pain_level}/10). Limit physical triggers and review pain management steps.`);
      }
    }
  }

  // 4. Advanced Correlation Analytics
  // A. Dizziness & Low glucose correlation
  const lowSugarDays = logs.filter(l => l.glucose !== null && l.glucose < 90);
  const lowSugarDizzyDays = lowSugarDays.filter(l => {
    const sym = l.symptoms ? l.symptoms.toLowerCase() : "";
    return sym.includes("dizzy") || sym.includes("lighthead") || sym.includes("faint");
  });
  if (lowSugarDays.length >= 2 && lowSugarDizzyDays.length > 0) {
    const percent = Math.round((lowSugarDizzyDays.length / lowSugarDays.length) * 100);
    result.correlations.push(`🔍 CORRELATION DETECTED: Symptoms of dizziness occur in ${percent}% of logs with lower glucose levels (<90 mg/dL). Prioritize carrying glucose tablets.`);
  }

  // B. Headaches & High systolic blood pressure correlation
  const highSysDays = logs.filter(l => l.bp_systolic !== null && l.bp_systolic > 130);
  const highSysHeadacheDays = highSysDays.filter(l => {
    const sym = l.symptoms ? l.symptoms.toLowerCase() : "";
    return sym.includes("headache") || sym.includes("migraine") || sym.includes("blurry");
  });
  if (highSysDays.length >= 2 && highSysHeadacheDays.length > 0) {
    const percent = Math.round((highSysHeadacheDays.length / highSysDays.length) * 100);
    result.correlations.push(`🔍 CORRELATION DETECTED: Headache reports occur in ${percent}% of logs with elevated systolic BP (>130 mmHg). Report persistent headaches to Dr. Evelyn Ramirez.`);
  }

  // C. Skipped breakfast spikes correlation
  const skippedBreakfastLogs = logs.filter(l => l.meal === "skipped");
  const skippedBreakfastGlucose = skippedBreakfastLogs.filter(l => l.glucose > 140);
  if (skippedBreakfastLogs.length >= 2 && skippedBreakfastGlucose.length > 0) {
    const percent = Math.round((skippedBreakfastGlucose.length / skippedBreakfastLogs.length) * 100);
    result.correlations.push(`🔍 PATTERN ALERT: Skipping breakfast correlates with glucose spikes (>140 mg/dL) in ${percent}% of instances. Consistent meal schedules are highly advised.`);
  }

  // D. Anxiety & Heart Rate correlation
  const highAnxietyDays = logs.filter(l => l.anxiety_level !== null && l.anxiety_level >= 10);
  const highAnxietyHrDays = highAnxietyDays.filter(l => l.heart_rate !== null && l.heart_rate > 90);
  if (highAnxietyDays.length >= 2 && highAnxietyHrDays.length > 0) {
    const percent = Math.round((highAnxietyHrDays.length / highAnxietyDays.length) * 100);
    result.correlations.push(`🔍 ANXIETY COUPLING: Elevated heart rate (>90 bpm) accompanies your high anxiety days (GAD-7 >= 10) in ${percent}% of logs. Incorporate paced breathing.`);
  }

  // E. Pain & BP correlation
  const highPainDays = logs.filter(l => l.pain_level !== null && l.pain_level >= 6);
  const highPainBpDays = highPainDays.filter(l => l.bp_systolic !== null && l.bp_systolic >= 135);
  if (highPainDays.length >= 2 && highPainBpDays.length > 0) {
    const percent = Math.round((highPainBpDays.length / highPainDays.length) * 100);
    result.correlations.push(`🔍 PAIN STRESS COUPLING: Elevated blood pressure (Systolic >= 135 mmHg) is paired with moderate/severe pain days (Pain >= 6) in ${percent}% of logs. Pain management may help stabilize BP.`);
  }

  // F. Asthma Inhaler & Peak Flow correlation
  const pfDropDays = logs.filter(l => l.peak_flow !== null && l.peak_flow < 450);
  const pfDropRescueDays = pfDropDays.filter(l => l.inhaler_puffs !== null && l.inhaler_puffs > 0);
  if (pfDropDays.length >= 2 && pfDropRescueDays.length > 0) {
    const percent = Math.round((pfDropRescueDays.length / pfDropDays.length) * 100);
    result.correlations.push(`🔍 AIRWAY COMPLIANCE: Rescue inhaler use is triggered on ${percent}% of days where peak expiratory flow drops below 450 L/min.`);
  }

  // G. General Insights
  if (lastLog) {
    if (lastLog.glucose > gMax && lastLog.glucose <= 180) {
      result.insights.push("💡 Last glucose was above target. A brisk 15-minute walk can help lower blood sugar levels naturally.");
    }
    if (lastLog.bp_systolic > bpSysMax && lastLog.bp_systolic < 140) {
      result.insights.push("💡 Last blood pressure was elevated. Make sure to rest for 5 minutes in a quiet room before measuring.");
    }
    if (lastLog.anxiety_level !== null && lastLog.anxiety_level >= 5 && lastLog.anxiety_level < 10) {
      result.insights.push("💡 Mild anxiety logged. Standard guidelines suggest incorporating deep breathing or progressive muscle relaxation.");
    }
    if (lastLog.peak_flow !== null && lastLog.peak_flow >= 450 && lastLog.peak_flow < 500) {
      result.insights.push("💡 Peak flow is stable but slightly under baseline. Avoid cold air or triggers that induce asthma.");
    }
  }

  return result;
}
