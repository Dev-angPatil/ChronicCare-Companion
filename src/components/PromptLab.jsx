import React from 'react';

const DIAGNOSTIC_PROMPTS = [
  {
    title: "🔍 Check My Wellness Trends",
    prompt: "What are my predicted risks based on my logged biometrics?",
    description: "Triggers the linear regression forecast for hypoglycemia and hypertensive crisis."
  },
  {
    title: "🩺 Prepare for Physician Consultation",
    prompt: "I have an appointment with Dr. Evelyn Ramirez soon. Can you summarize my medication compliance, glucose peaks, and symptoms over the last week so I can show them?",
    description: "Aggregates compliance scores and averages for easy export to your doctor."
  },
  {
    title: "⚠️ High Blood Pressure Analysis",
    prompt: "I have a headache. Can you look at my blood pressure trends and see if there is a pattern?",
    description: "Evaluates correlation logs between systolic readings and reported headaches."
  },
  {
    title: "🍎 Breakfast Skipping Correlation",
    prompt: "How does skipping breakfast affect my glucose spikes in the afternoon?",
    description: "Checks if skipped meal logs are correlated with subsequent glucose values > 140 mg/dL."
  },
  {
    title: "🚨 Low Blood Sugar Response Checklist",
    prompt: "I feel dizzy. What should I do immediately for low blood sugar?",
    description: "Clinical protocol for managing a hypoglycemic dip (<70 mg/dL)."
  }
];

export default function PromptLab({ isOpen, onClose, onSelectPrompt }) {
  return (
    <>
      <div 
        className={`prompt-lab-overlay ${isOpen ? 'open' : ''}`} 
        onClick={onClose}
      />
      <div className={`prompt-lab-drawer ${isOpen ? 'open' : ''}`}>
        <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <h2 className="font-serif" style={{ fontSize: '1.5rem', margin: 0 }}>Prompt Lab</h2>
          <button 
            type="button"
            className="btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.85rem' }} 
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <p className="text-secondary text-sm">
          Select a clinical prompt template to feed directly to the Clinical Companion assistant.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {DIAGNOSTIC_PROMPTS.map((item, index) => (
            <div 
              key={`prompt-${index}`} 
              className="glass-panel" 
              style={{ padding: '16px', cursor: 'pointer', background: 'var(--border-light)', transition: 'var(--transition-smooth)' }}
              onClick={() => {
                onSelectPrompt(item.prompt);
                onClose();
              }}
            >
              <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                {item.title}
              </strong>
              <span className="text-muted text-sm" style={{ display: 'block', marginBottom: '8px' }}>
                {item.description}
              </span>
              <div 
                style={{ 
                  fontSize: '0.85rem', 
                  fontStyle: 'italic', 
                  color: 'var(--primary)', 
                  borderLeft: '2px solid var(--primary)', 
                  paddingLeft: '8px',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '6px'
                }}
              >
                "{item.prompt}"
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
