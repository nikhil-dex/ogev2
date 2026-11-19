// Keep the Gemini proposal separate from the editor until the user accepts it.
// Exact source fields and note identity must still match before applying.
export function geminiDraftSnapshot(editor = {}) {
  return {
    heading: editor.heading ?? '',
    answer: editor.answer ?? '',
    tagsText: editor.tagsText ?? '',
    activeSubject: editor.activeSubject ?? '',
    editingId: editor.editingId ?? '',
    newDraftId: editor.newDraftId ?? '',
  };
}

export function isGeminiSuggestionCurrent(original, editor) {
  if (!original || !editor) return false;
  const current = geminiDraftSnapshot(editor);
  return Object.keys(current).every((key) => original[key] === current[key]);
}
