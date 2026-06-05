import React, { useState } from 'react';
import { setProfile, updateMedication, addLog, logUserActivity } from '../utils/db.js';

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  
  // Step 1: Profile State
  const [profile, setProfileState] = useState({
    name: '',
    conditions: 'Diabetes, Hypertension',
    physicianName: 'Dr. Evelyn Ramirez',
    physicianPhone: '555-0147',
    physicianClinic: 'Oakridge Primary Care Center',
    glucoseFastingTargetMin: 80,
    glucoseFastingTargetMax: 130,
    glucosePostprandialMax: 180,
    glucoseHypoThreshold: 70,
    bpSystolicTargetMax: 130,
    bpDiastolicTargetMax: 80,
    bpStage: 'Normal'
  });

  // Step 2: Medications State
  const [medsList, setMedsList] = useState([
    { id: 'metformin', name: 'Metformin', dose: '500mg', frequency: 'Twice daily (Morning/Night)', taken: false, remainingHours: 12 },
    { id: 'amlodipine', name: 'Amlodipine', dose: '5mg', frequency: 'Once daily (Morning)', taken: false, remainingHours: 24 }
  ]);
  const [newMed, setNewMed] = useState({ name: '', dose: '', frequency: '' });

  // Step 3: Baseline Log State
  const [baselineLog, setBaselineLog] = useState({
    glucose: 110,
    bpSystolic: 120,
    bpDiastolic: 80,
    anxietyLevel: 5,
    heartRate: 75,
    peakFlow: 500,
    inhalerPuffs: 0,
    painLevel: 2,
    meal: 'yes',
    symptoms: 'Feeling fine'
  });

  // Action: Add Custom Medication
  const handleAddMed = () => {
    if (!newMed.name || !newMed.dose) return;
    const id = newMed.name.toLowerCase().replace(/\s+/g, '-');
    const med = {
      id,
      name: newMed.name,
      dose: newMed.dose,
      frequency: newMed.frequency || 'Once daily',
      taken: false,
      remainingHours: 24
    };
    setMedsList([...medsList, med]);
    setNewMed({ name: '', dose: '', frequency: '' });
  };

  // Action: Remove Medication
  const handleRemoveMed = (id) => {
    setMedsList(medsList.filter(m => m.id !== id));
  };

  // Action: Finish Wizard
  const handleFinish = async () => {
    try {
      // 1. Calculate blood pressure stage dynamically
      let stage = 'Normal';
      const sys = baselineLog.bpSystolic;
      const dia = baselineLog.bpDiastolic;
      if (sys >= 140 || dia >= 90) stage = 'Stage 2 Hypertension';
      else if ((sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89)) stage = 'Stage 1 Hypertension';
      else if (sys >= 120 && sys <= 129 && dia < 80) stage = 'Elevated Blood Pressure';

      const finalProfile = {
        ...profile,
        bpStage: stage,
        targets: `Fasting glucose: ${profile.glucoseFastingTargetMin}–${profile.glucoseFastingTargetMax} mg/dL, BP: <${profile.bpSystolicTargetMax}/${profile.bpDiastolicTargetMax} mmHg`
      };

      // 2. Save profile
      await setProfile(finalProfile);

      // 3. Save medications
      for (const med of medsList) {
        await updateMedication(med);
      }

      // 4. Save baseline log
      const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).replace(',', '');
      
      const isDiabetes = profile.conditions.toLowerCase().includes('diabetes');
      const isHypertension = profile.conditions.toLowerCase().includes('hypertension');
      const isAnxiety = profile.conditions.toLowerCase().includes('anxiety');
      const isAsthma = profile.conditions.toLowerCase().includes('asthma');
      const isPain = profile.conditions.toLowerCase().includes('pain');

      const initialLog = {
        date: todayStr,
        glucose: isDiabetes ? Number(baselineLog.glucose) : null,
        bp: (isHypertension || isAnxiety) ? `${baselineLog.bpSystolic}/${baselineLog.bpDiastolic}` : null,
        meal: isDiabetes ? baselineLog.meal : 'n/a',
        symptoms: baselineLog.symptoms,
        anxietyLevel: isAnxiety ? Number(baselineLog.anxietyLevel) : null,
        heartRate: (isAnxiety || isHypertension) ? Number(baselineLog.heartRate) : null,
        peakFlow: isAsthma ? Number(baselineLog.peakFlow) : null,
        inhalerPuffs: isAsthma ? Number(baselineLog.inhalerPuffs) : null,
        painLevel: isPain ? Number(baselineLog.painLevel) : null
      };

      await addLog(initialLog);
      await logUserActivity('onboarding_complete', `User completed clinical onboarding wizard for conditions: ${profile.conditions}.`);

      onComplete();
    } catch (err) {
      console.error('Failed to save onboarding data:', err);
    }
  };

  return (
    <div className="wizard-container">
      <div className="glass-panel">
        <h2 className="font-serif heading-section" style={{ textAlign: 'center', marginBottom: '8px' }}>
          Personalize Your Care
        </h2>
        <p className="text-muted text-sm" style={{ textAlign: 'center', marginBottom: '32px' }}>
          Initialize your chronic care clinical indicators.
        </p>

        {/* Wizard Steps Progress Indicator */}
        <div className="wizard-progress">
          <div className="wizard-progress-bar" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
          <div className={`wizard-step-indicator ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>1</div>
          <div className={`wizard-step-indicator ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>2</div>
          <div className={`wizard-step-indicator ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>

        {/* STEP 1: Profile Setup */}
        {step === 1 && (
          <div className="wizard-step-content android-slide-in-right">
            <h3 className="heading-card">Step 1: Patient Profile & Physician</h3>
            
            <div>
              <label className="input-label" htmlFor="patient-name">Patient Full Name</label>
              <input 
                id="patient-name"
                type="text" 
                className="input-field" 
                placeholder="e.g. Alex Mercer"
                value={profile.name}
                onChange={e => setProfileState({ ...profile, name: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label">Chronic Conditions Covered</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginTop: '8px' }}>
                {[
                  { id: 'diabetes', label: 'Diabetes 🩸' },
                  { id: 'hypertension', label: 'Hypertension 🩺' },
                  { id: 'anxiety', label: 'Anxiety 🧠' },
                  { id: 'asthma', label: 'Asthma 🫁' },
                  { id: 'pain', label: 'Chronic Pain ⚡' }
                ].map(cond => {
                  const isChecked = profile.conditions.toLowerCase().includes(cond.id) || (cond.id === 'diabetes' && profile.conditions.toLowerCase().includes('diabetes'));
                  const handleToggle = () => {
                    let currentList = profile.conditions.split(',').map(s => s.trim()).filter(Boolean);
                    const condLabel = cond.label.split(' ')[0];
                    const actualLabel = cond.id === 'pain' ? 'Chronic Pain' : condLabel;
                    
                    if (isChecked) {
                      currentList = currentList.filter(c => c.toLowerCase() !== actualLabel.toLowerCase() && c.toLowerCase() !== cond.id);
                    } else {
                      currentList.push(actualLabel);
                    }
                    setProfileState({ ...profile, conditions: currentList.join(', ') });
                  };

                  return (
                    <div 
                      key={cond.id} 
                      onClick={handleToggle}
                      style={{
                        padding: '12px',
                        border: isChecked ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        background: isChecked ? 'rgba(230, 0, 35, 0.05)' : 'var(--surface-card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      <span>{cond.label}</span>
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={handleToggle} 
                        style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid-2">
              <div>
                <label className="input-label" htmlFor="physician-name">Primary Physician</label>
                <input 
                  id="physician-name"
                  type="text" 
                  className="input-field" 
                  value={profile.physicianName}
                  onChange={e => setProfileState({ ...profile, physicianName: e.target.value })}
                />
              </div>
              <div>
                <label className="input-label" htmlFor="clinic-name">Clinic/Center</label>
                <input 
                  id="clinic-name"
                  type="text" 
                  className="input-field" 
                  value={profile.physicianClinic}
                  onChange={e => setProfileState({ ...profile, physicianClinic: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="input-label" htmlFor="physician-phone">Physician Contact Phone</label>
              <input 
                id="physician-phone"
                type="text" 
                className="input-field" 
                value={profile.physicianPhone}
                onChange={e => setProfileState({ ...profile, physicianPhone: e.target.value })}
              />
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '12px 0' }} />

            <h4 style={{ fontWeight: '600', fontSize: '0.95rem' }}>Clinical Threshold Targets</h4>
            <div className="grid-2">
              <div>
                <label className="input-label" htmlFor="target-glucose-min">Target Glucose Min (mg/dL)</label>
                <input 
                  id="target-glucose-min"
                  type="number" 
                  className="input-field" 
                  value={profile.glucoseFastingTargetMin}
                  onChange={e => setProfileState({ ...profile, glucoseFastingTargetMin: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="input-label" htmlFor="target-glucose-max">Target Glucose Max (mg/dL)</label>
                <input 
                  id="target-glucose-max"
                  type="number" 
                  className="input-field" 
                  value={profile.glucoseFastingTargetMax}
                  onChange={e => setProfileState({ ...profile, glucoseFastingTargetMax: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid-2">
              <div>
                <label className="input-label" htmlFor="systolic-limit">Systolic Limit (mmHg)</label>
                <input 
                  id="systolic-limit"
                  type="number" 
                  className="input-field" 
                  value={profile.bpSystolicTargetMax}
                  onChange={e => setProfileState({ ...profile, bpSystolicTargetMax: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="input-label" htmlFor="diastolic-limit">Diastolic Limit (mmHg)</label>
                <input 
                  id="diastolic-limit"
                  type="number" 
                  className="input-field" 
                  value={profile.bpDiastolicTargetMax}
                  onChange={e => setProfileState({ ...profile, bpDiastolicTargetMax: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Medications */}
        {step === 2 && (
          <div className="wizard-step-content android-slide-in-right">
            <h3 className="heading-card">Step 2: Active Prescriptions</h3>
            <p className="text-secondary text-sm">
              Define the daily medications you need to track compliance for.
            </p>

            <div className="meds-grid" style={{ marginBottom: '24px' }}>
              {medsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                  No medications added. Click below to add.
                </div>
              ) : (
                medsList.map(med => (
                  <div className="med-item" key={med.id}>
                    <div className="med-item-info">
                      <strong style={{ color: 'var(--text-primary)' }}>{med.name} {med.dose}</strong>
                      <span className="text-muted text-sm">{med.frequency}</span>
                    </div>
                    <button className="btn-danger" onClick={() => handleRemoveMed(med.id)} style={{ padding: '6px 12px' }}>
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="glass-panel" style={{ background: 'var(--border-light)', padding: '20px' }}>
              <h4 style={{ fontWeight: '600', marginBottom: '12px' }}>Add Prescription</h4>
              <div className="grid-2" style={{ marginBottom: '12px' }}>
                <div>
                  <label className="input-label" htmlFor="med-name">Medication Name</label>
                  <input 
                    id="med-name"
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Metformin" 
                    value={newMed.name}
                    onChange={e => setNewMed({ ...newMed, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="med-dose">Dose</label>
                  <input 
                    id="med-dose"
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. 500mg" 
                    value={newMed.dose}
                    onChange={e => setNewMed({ ...newMed, dose: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label" htmlFor="med-frequency">Frequency</label>
                <input 
                  id="med-frequency"
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Twice daily (Morning/Night)" 
                  value={newMed.frequency}
                  onChange={e => setNewMed({ ...newMed, frequency: e.target.value })}
                />
              </div>
              <button type="button" className="btn-primary" onClick={handleAddMed} style={{ width: '100%', justifyContent: 'center' }}>
                Add to Schedule
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Baseline Log Entry */}
        {step === 3 && (
          <div className="wizard-step-content android-slide-in-right">
            <h3 className="heading-card">Step 3: Baseline Check-in</h3>
            <p className="text-secondary text-sm">
              Log your initial biometric values for today to initialize the clinical prediction engine.
            </p>

            {profile.conditions.toLowerCase().includes('diabetes') && (
              <div className="grid-2" style={{ marginBottom: '16px' }}>
                <div>
                  <label className="input-label" htmlFor="baseline-glucose">Blood Glucose (mg/dL)</label>
                  <input 
                    id="baseline-glucose"
                    type="number" 
                    className="input-field" 
                    value={baselineLog.glucose}
                    onChange={e => setBaselineLog({ ...baselineLog, glucose: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="breakfast-status">Breakfast Logged</label>
                  <select 
                    id="breakfast-status"
                    className="input-field"
                    value={baselineLog.meal}
                    onChange={e => setBaselineLog({ ...baselineLog, meal: e.target.value })}
                  >
                    <option value="yes">Breakfast Consumed</option>
                    <option value="skipped">Skipped Breakfast</option>
                  </select>
                </div>
              </div>
            )}

            {(profile.conditions.toLowerCase().includes('hypertension') || profile.conditions.toLowerCase().includes('anxiety')) && (
              <div className="grid-2" style={{ marginBottom: '16px' }}>
                <div>
                  <label className="input-label" htmlFor="baseline-systolic">Blood Pressure: Systolic (mmHg)</label>
                  <input 
                    id="baseline-systolic"
                    type="number" 
                    className="input-field" 
                    placeholder="e.g. 120"
                    value={baselineLog.bpSystolic}
                    onChange={e => setBaselineLog({ ...baselineLog, bpSystolic: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="baseline-diastolic">Blood Pressure: Diastolic (mmHg)</label>
                  <input 
                    id="baseline-diastolic"
                    type="number" 
                    className="input-field" 
                    placeholder="e.g. 80"
                    value={baselineLog.bpDiastolic}
                    onChange={e => setBaselineLog({ ...baselineLog, bpDiastolic: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}

            {profile.conditions.toLowerCase().includes('anxiety') && (
              <div className="grid-2" style={{ marginBottom: '16px' }}>
                <div>
                  <label className="input-label" htmlFor="baseline-anxiety">Anxiety GAD-7 Score (0–21)</label>
                  <input 
                    id="baseline-anxiety"
                    type="range"
                    min="0"
                    max="21"
                    className="input-field" 
                    value={baselineLog.anxietyLevel}
                    onChange={e => setBaselineLog({ ...baselineLog, anxietyLevel: Number(e.target.value) })}
                  />
                  <div style={{ fontSize: '0.8rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                    Score: {baselineLog.anxietyLevel} ({baselineLog.anxietyLevel < 5 ? 'Minimal' : baselineLog.anxietyLevel < 10 ? 'Mild' : baselineLog.anxietyLevel < 15 ? 'Moderate' : 'Severe'})
                  </div>
                </div>
                <div>
                  <label className="input-label" htmlFor="baseline-hr">Resting Heart Rate (bpm)</label>
                  <input 
                    id="baseline-hr"
                    type="number"
                    className="input-field" 
                    value={baselineLog.heartRate}
                    onChange={e => setBaselineLog({ ...baselineLog, heartRate: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}

            {profile.conditions.toLowerCase().includes('asthma') && (
              <div className="grid-2" style={{ marginBottom: '16px' }}>
                <div>
                  <label className="input-label" htmlFor="baseline-pf">Peak Expiratory Flow (L/min)</label>
                  <input 
                    id="baseline-pf"
                    type="number"
                    className="input-field" 
                    value={baselineLog.peakFlow}
                    onChange={e => setBaselineLog({ ...baselineLog, peakFlow: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="baseline-puffs">Rescue Inhaler Puffs Count</label>
                  <input 
                    id="baseline-puffs"
                    type="number"
                    className="input-field" 
                    value={baselineLog.inhalerPuffs}
                    onChange={e => setBaselineLog({ ...baselineLog, inhalerPuffs: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}

            {profile.conditions.toLowerCase().includes('pain') && (
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label" htmlFor="baseline-pain">Chronic Pain Level (NRS 0–10)</label>
                <input 
                  id="baseline-pain"
                  type="range"
                  min="0"
                  max="10"
                  className="input-field" 
                  value={baselineLog.painLevel}
                  onChange={e => setBaselineLog({ ...baselineLog, painLevel: Number(e.target.value) })}
                />
                <div style={{ fontSize: '0.8rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                  Pain: {baselineLog.painLevel}/10 ({baselineLog.painLevel === 0 ? 'No Pain' : baselineLog.painLevel < 4 ? 'Mild' : baselineLog.painLevel < 7 ? 'Moderate' : 'Severe'})
                </div>
              </div>
            )}

            <div>
              <label className="input-label" htmlFor="baseline-symptoms">Symptoms Reported</label>
              <input 
                id="baseline-symptoms"
                type="text" 
                className="input-field" 
                placeholder="e.g. Feeling fine, mild headache, dizzy" 
                value={baselineLog.symptoms}
                onChange={e => setBaselineLog({ ...baselineLog, symptoms: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="wizard-actions">
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => setStep(step - 1)} 
            disabled={step === 1}
          >
            Back
          </button>
          
          {step < 3 ? (
            <button 
              type="button" 
              className="btn-primary" 
              onClick={() => {
                if (step === 1 && !profile.name) {
                  alert('Please enter your name.');
                  return;
                }
                setStep(step + 1);
              }}
            >
              Next Step
            </button>
          ) : (
            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleFinish}
              style={{ background: 'var(--color-success)' }}
            >
              Finish & Go to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
