// Shared homepage catalog: stable preference IDs; routes remain unchanged.
export const HOME_MODULES = Object.freeze([
  { id: 'notes', label: 'Notes', description: 'Organize study notes.' },
  { id: 'airnotes', label: 'AirNotes', description: 'Ideas and personal writing.' },
  { id: 'revision', label: 'Revision', description: 'Review what you have learned.' },
  { id: 'history', label: 'Note History', description: 'See previous note versions.' },
  { id: 'files', label: 'My Files', description: 'Documents and attachments.' },
  { id: 'links', label: 'Saved Links', description: 'Keep useful websites handy.' },
  { id: 'customs', label: 'Custom Pages', description: 'HTML pages, PDFs and images.' },
  { id: 'backup', label: 'Backup & Recovery', description: 'Download and recover your data.' },
  { id: 'extension', label: 'Browser Extension', description: 'Save things from your browser.' },
  { id: 'learning-tracks', label: 'Learning Tracks', description: 'Study from video playlists.' },
  { id: 'quick-notes', label: 'Quick Notes', description: 'Extension capture inbox.' },
]);
export const DEFAULT_HOME_MODULES = Object.freeze(['notes', 'airnotes', 'revision', 'files']);
const KNOWN = new Set(HOME_MODULES.map(({ id }) => id));

// A null preference means a pre-existing account: preserve its original
// homepage until the owner explicitly customizes it in Settings.
export function parseHomeModules(value) {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter((id) => typeof id === 'string' && KNOWN.has(id)))];
}
export function validateHomeModules(value) {
  return Array.isArray(value) && value.length <= HOME_MODULES.length &&
    value.every((id) => typeof id === 'string' && KNOWN.has(id)) &&
    new Set(value).size === value.length;
}
export function homeModuleVisible(preferences, id) {
  return preferences === null || preferences.includes(id);
}
export function homeModuleIdForHref(href) {
  if (href === '/notes' || href === '/vault/notes') return 'notes';
  if (href === '/saved-links') return 'links';
  if (href === '/extension') return 'extension';
  if (href === '/revision' || href === '/vault/study') return 'revision';
  if (href === '/revision-history' || href === '/vault/history') return 'history';
  if (href === '/files') return 'files';
  if (href === '/customs') return 'customs';
  if (href === '/vault/backup') return 'backup';
  if (href === '/learning-tracks') return 'learning-tracks';
  return null;
}
