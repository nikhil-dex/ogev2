'use client';
import { useEffect, useRef } from 'react';
import { isGeminiSuggestionCurrent } from '../../lib/oge-gemini-review.js';

export default function GeminiNoteReview({ suggestion, current, onApply, onCancel }) {
  const reviewRef = useRef(null);
  useEffect(() => {
    if (!suggestion) return;
    // The result lives below a potentially long editor. Bring it into view
    // only when a new suggestion arrives, not when the user keeps typing.
    reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [suggestion]);
  if (!suggestion) return null;
  const stale = !isGeminiSuggestionCurrent(suggestion.original, current);
  const originalTags = suggestion.original.tagsText;
  const suggestedTags = suggestion.suggested.tagsText;
  return <section ref={reviewRef} className="oge-gemini-review" aria-label="Gemini cleanup suggestion">
    <div className="oge-gemini-review-title">
      <div className="oge-gemini-review-heading">
        <span className="oge-gemini-review-sparkle" aria-hidden="true">✦</span>
        <div><strong>Review Gemini suggestion</strong>
          <p>Compare the original and improved Note before applying.</p></div>
      </div>
      <span className="oge-gemini-review-status">Not applied yet</span>
    </div>
    <div className="oge-gemini-review-grid">
      <section className="oge-gemini-review-pane oge-gemini-review-original" aria-label="Original draft">
        <div className="oge-gemini-review-pane-heading"><h3>Original draft</h3><span>Before</span></div>
        <strong>{suggestion.original.heading}</strong>
        <p className="oge-gemini-review-tags">Tags: {originalTags || 'None'}</p>
        <pre>{suggestion.original.answer}</pre>
      </section>
      <section className="oge-gemini-review-pane oge-gemini-review-improved" aria-label="Gemini suggestion">
        <div className="oge-gemini-review-pane-heading"><h3>Gemini suggestion</h3><span>After</span></div>
        <strong>{suggestion.suggested.heading}</strong>
        <p className="oge-gemini-review-tags">Tags: {suggestedTags || 'None'}</p>
        <pre>{suggestion.suggested.answer}</pre>
      </section>
    </div>
    {stale && <p className="form-error" role="alert">
      Your draft changed after Gemini started. Run cleanup again to protect your newer edits.
    </p>}
    <div className="oge-gemini-review-footer">
      <p className="oge-gemini-review-hint">Review facts, code and 📌 Imp Notes. Applying only changes your draft; press Save afterward.</p>
      <div className="oge-gemini-review-actions">
        <button type="button" className="answer-expand-button" onClick={onCancel}>Cancel suggestion</button>
        <button type="button" className="oge-google-button" disabled={stale} onClick={onApply}>Apply to draft</button>
      </div>
    </div>
  </section>;
}
