// Account-level homepage tools. Missing settings preserve existing accounts.
export const OPTIONAL_FEATURES = Object.freeze([
  { id: 'news', label: 'News', description: 'Personalized news feed and News navigation.' },
  { id: 'dictionary', label: 'Dictionary', description: 'English word meanings and explanations.' },
]);
export const DEFAULT_OPTIONAL_FEATURES = Object.freeze(['news', 'dictionary']);
const KNOWN = new Set(DEFAULT_OPTIONAL_FEATURES);

export function parseOptionalFeatures(value) {
  if (!Array.isArray(value)) return [...DEFAULT_OPTIONAL_FEATURES];
  return [...new Set(value.filter((id) => typeof id === 'string' && KNOWN.has(id)))];
}
export function validateOptionalFeatures(value) {
  return Array.isArray(value) && value.length <= KNOWN.size &&
    value.every((id) => typeof id === 'string' && KNOWN.has(id)) &&
    new Set(value).size === value.length;
}
export function optionalFeatureEnabled(value, feature) {
  return parseOptionalFeatures(value).includes(feature);
}
