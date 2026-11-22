'use client';

import { useState } from 'react';
import { NEWS_TOPICS } from '../../lib/news-topics.js';
import { HOME_MODULES, DEFAULT_HOME_MODULES } from '../../lib/home-modules.js';
import { saveNewsInterests } from './actions.js';

const HEADINGS = [
  ['Welcome to Oge', 'A simpler space for everything you learn and create.'],
  ['Your news, your interests', 'Pick up to 10 topics or skip for a general news feed.'],
  ['Make your workspace yours', 'Choose the tools you want on your homepage. You can change this later in Settings.'],
  ['Choose where Notes live', 'One final choice before entering your workspace or connecting GitHub.'],
];

export default function OnboardingWizard({ initialInterests = [], initialStorage = '' }) {
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState(initialInterests.length ? initialInterests : ['Technology', 'Artificial Intelligence', 'Science']);
  const [storage, setStorage] = useState(['github', 'mongodb'].includes(initialStorage) ? initialStorage : '');
  const [modules, setModules] = useState([...DEFAULT_HOME_MODULES]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function advance() {
    setError('');
    setStep((current) => Math.min(current + 1, 3));
  }

  function toggleInterest(topic) {
    setInterests((current) => current.includes(topic)
      ? current.filter((item) => item !== topic)
      : current.length >= 10 ? current : [...current, topic]);
  }

  function toggleModule(id) {
    setModules((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  return (
    <section className="oge-onboarding-wizard" aria-labelledby="wizard-title">
      <header className="oge-wizard-header">
        <span className="oge-eyebrow">PERSONALIZE YOUR WORKSPACE</span>
        <span className="oge-wizard-step">STEP {step + 1} / 4</span>
      </header>
      <div className="oge-wizard-progress" aria-label={`Step ${step + 1} of 4`}>
        {[0, 1, 2, 3].map((index) => <span key={index} className={index <= step ? 'is-active' : ''} />)}
      </div>
      <div className="oge-wizard-intro">
        <h1 id="wizard-title">{HEADINGS[step][0]}<span>.</span></h1>
        <p>{HEADINGS[step][1]}</p>
      </div>

      <form action={saveNewsInterests} onSubmit={(event) => {
        if (step !== 3) {
          event.preventDefault();
          setError('Finish the storage step before completing onboarding.');
          setStep(3);
          return;
        }
        if (!storage) {
          event.preventDefault();
          setError('Select a Notes storage option.');
          setStep(3);
          return;
        }
        setSubmitting(true);
      }}>
        {/* Keep all choices in the single existing server action, even when
            the corresponding wizard step is not currently displayed. */}
        {interests.map((topic) => <input key={topic} type="hidden" name="interest" value={topic} />)}
        {modules.map((id) => <input key={id} type="hidden" name="homeModule" value={id} />)}
        <input type="hidden" name="notesStorage" value={storage} />
        {step === 3 && <input type="hidden" name="wizardComplete" value="true" />}
        {step === 0 && <div className="oge-wizard-welcome">
          <span className="oge-wizard-monogram" aria-hidden="true">O</span>
          <h2>One home for your ideas.</h2>
          <p>Keep Notes, useful links and study tools together. We&apos;ll only ask for a few preferences to get you started.</p>
          <p className="oge-onboarding-description">This setup takes just a few choices. You can personalize your homepage again at any time.</p>
        </div>}
        {step === 1 && <>
          <div className="oge-wizard-choice-grid">
            {NEWS_TOPICS.map((topic) =>
              <button key={topic} type="button"
                className={`oge-wizard-choice ${interests.includes(topic) ? 'is-selected' : ''}`}
                aria-pressed={interests.includes(topic)}
                onClick={() => toggleInterest(topic)}>
                <span aria-hidden="true">{interests.includes(topic) ? '✓' : '+'}</span>{topic}
              </button>)}
          </div>
          <p className="oge-onboarding-description">{interests.length}/10 selected · All choices optional.</p>
        </>}
        {step === 2 && <>
          <div className="oge-wizard-choice-grid oge-wizard-modules">
            {HOME_MODULES.map((item) => <button key={item.id} type="button"
              className={`oge-wizard-choice oge-wizard-module ${modules.includes(item.id) ? 'is-selected' : ''}`}
              aria-pressed={modules.includes(item.id)}
              onClick={() => toggleModule(item.id)}>
              <span aria-hidden="true">{modules.includes(item.id) ? '✓' : '+'}</span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
            </button>)}
          </div>
          <div className="oge-wizard-module-tools">
            <span>{modules.length} chosen · Hidden modules still work when available.</span>
            <button type="button" onClick={() => setModules([...DEFAULT_HOME_MODULES])}>Use recommended</button>
            <button type="button" onClick={() => setModules([])}>Choose later</button>
          </div>
        </>}
        {step === 3 && <div className="oge-storage-options">
          <button type="button" className={`oge-wizard-storage ${storage === 'mongodb' ? 'is-selected' : ''}`}
            aria-pressed={storage === 'mongodb'} onClick={() => { setStorage('mongodb'); setError(''); }}>
            <span className="oge-wizard-storage-icon" aria-hidden="true">☁</span>
            <strong>Oge Cloud</strong><small>MongoDB · Ready immediately</small>
            <span>Your Notes are saved in Oge&apos;s managed database. No GitHub account needed.</span>
            <em>{storage === 'mongodb' ? '✓ Selected' : 'Select Oge Cloud'}</em>
          </button>
          <button type="button" className={`oge-wizard-storage ${storage === 'github' ? 'is-selected' : ''}`}
            aria-pressed={storage === 'github'} onClick={() => { setStorage('github'); setError(''); }}>
            <span className="oge-wizard-storage-icon" aria-hidden="true">⌘</span>
            <strong>My GitHub Repository</strong><small>Private repository · Git history</small>
            <span>Save Notes in your own private GitHub repository. Connect your GitHub account after onboarding; drafts temporarily autosave in Oge and your browser.</span>
            <em>{storage === 'github' ? '✓ Selected' : 'Select GitHub'}</em>
          </button>
          <p className="oge-onboarding-description oge-wizard-storage-help">Account details and preferences use MongoDB for both choices. GitHub requires a separate connection before Notes are ready.</p>
        </div>}
        {error && <p role="alert" className="oge-wizard-error">{error}</p>}
        <div className="oge-wizard-actions">
          {step > 0
            ? <button type="button" className="oge-skip-button" disabled={submitting} onClick={() => { setError(''); setStep(step - 1); }}>← Back</button>
            : <span className="oge-onboarding-description">OGE · YOUR SPACE</span>}
          <div className="oge-wizard-actions-right">
            {step === 1 && <button type="button" className="oge-skip-button" onClick={() => { setInterests([]); advance(); }}>Skip news</button>}
            {step < 3
              ? <button type="button" className="oge-google-button" onClick={advance}>Continue →</button>
              : <button type="submit" className="oge-google-button" disabled={submitting || !storage}>{submitting ? 'Saving…' : storage === 'github' ? 'Continue to GitHub setup →' : 'Open my workspace →'}</button>}
          </div>
        </div>
      </form>
    </section>
  );
}
