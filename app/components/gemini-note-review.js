'use client';
import { isGeminiSuggestionCurrent } from '../../lib/oge-gemini-review.js';

export default function GeminiNoteReview({ suggestion, current, onApply, onCancel }) {
  if (!suggestion) return null;
  const stale = !isGeminiSuggestionCurrent(suggestion.original, current);
  const originalTags = suggestion.original.tagsText;
  const suggestedTags = suggestion.suggested.tagsText;
  return <section className="oge-gemini-review" aria-label="Gemini cleanup suggestion">
    <div className="oge-gemini-review-title">
      <strong>✦ Review Gemini suggestion</strong>
      <p>Nothing has been changed yet. Compare both versions, then apply or cancel.</p>
    </div>
    <div className="oge-gemini-review-grid">
      <section className="oge-gemini-review-pane" aria-label="Original draft">
        <h3>Original draft</h3>
        <strong>{suggestion.original.heading}</strong>
        <p className="oge-gemini-review-tags">Tags: {originalTags || 'None'}</p>
        <pre>{suggestion.original.answer}</pre>
      </section>
      <section className="oge-gemini-review-pane" aria-label="Gemini suggestion">
        <h3>Gemini suggestion</h3>
        <strong>{suggestion.suggested.heading}</strong>
        <p className="oge-gemini-review-tags">Tags: {suggestedTags || 'None'}</p>
        <pre>{suggestion.suggested.answer}</pre>
      </section>
    </div>
    <p className="oge-gemini-review-hint">Check facts, code, formulas and the 📌 Imp Notes section before applying.</p>
    {stale && <p className="form-error" role="alert">
      Your draft changed after Gemini started. Run cleanup again to protect your newer edits.
    </p>}
    <div className="oge-gemini-review-actions">
      <button type="button" className="answer-expand-button" onClick={onCancel}>Cancel suggestion</button>
      <button type="button" className="oge-google-button" disabled={stale} onClick={onApply}>
        Apply to draft
      </button>
    </div>
  </section>;
}
