import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  OPTIONAL_FEATURES, DEFAULT_OPTIONAL_FEATURES, parseOptionalFeatures,
  validateOptionalFeatures, optionalFeatureEnabled,
} from '../lib/optional-features.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('News and Dictionary are both optional and legacy accounts keep them', () => {
  assert.deepEqual(OPTIONAL_FEATURES.map(({ id }) => id), ['news', 'dictionary']);
  assert.deepEqual(DEFAULT_OPTIONAL_FEATURES, ['news', 'dictionary']);
  assert.deepEqual(parseOptionalFeatures(undefined), ['news', 'dictionary']);
  assert.deepEqual(parseOptionalFeatures(null), ['news', 'dictionary']);
  assert.deepEqual(parseOptionalFeatures([]), []);
  assert.equal(optionalFeatureEnabled(undefined, 'news'), true);
  assert.equal(optionalFeatureEnabled(undefined, 'dictionary'), true);
  assert.equal(optionalFeatureEnabled(['dictionary'], 'news'), false);
  assert.equal(optionalFeatureEnabled(['news'], 'dictionary'), false);
  assert.deepEqual(parseOptionalFeatures(['news', 'news', 'unknown']), ['news']);
  assert.equal(validateOptionalFeatures([]), true);
  assert.equal(validateOptionalFeatures(['dictionary']), true);
  assert.equal(validateOptionalFeatures(['news', 'dictionary']), true);
  assert.equal(validateOptionalFeatures(['news', 'news']), false);
  assert.equal(validateOptionalFeatures(['unknown']), false);
  assert.equal(validateOptionalFeatures('news'), false);
});

test('onboarding persists optional choices with other preferences before GitHub handoff', async () => {
  const wizard = await read('../app/onboarding/onboarding-wizard.js');
  const action = await read('../app/onboarding/actions.js');
  assert.match(wizard, /OPTIONAL_FEATURES\.map/);
  assert.match(wizard, /name="optionalFeature"/);
  assert.match(wizard, /setOptionalFeatures/);
  assert.ok(wizard.indexOf('name="optionalFeature"') < wizard.indexOf('step === 3 &&'));
  assert.match(action, /validateOptionalFeatures\(selectedFeatures\)/);
  assert.match(action, /optionalFeatures: selectedFeatures/);
  assert.ok(action.indexOf('optionalFeatures: selectedFeatures') < action.indexOf("redirect('/vault?setup=onboarding')"));
});

test('Settings allows enabling or disabling both options independently', async () => {
  const page = await read('../app/settings/page.js');
  const action = await read('../app/settings/feature-actions.js');
  assert.match(page, /id="optional-features"/);
  assert.match(page, /OPTIONAL_FEATURES\.map/);
  assert.match(page, /name="optionalFeature"/);
  assert.match(page, /optionalFeatureEnabled\(user.optionalFeatures, feature.id\)/);
  assert.match(action, /validateOptionalFeatures\(features\)/);
  assert.match(action, /ownerMutationFilter\(session.user.id/);
  assert.match(action, /optionalFeatures: features/);
});

test('home hides opted-out widgets, and navbar uses authenticated preference', async () => {
  const home = await read('../app/page.js');
  const navbar = await read('../app/components/site-navbar.js');
  const endpoint = await read('../app/api/preferences/features/route.js');
  assert.match(home, /optionalFeatures: 1/);
  assert.match(home, /showNews && <HomeNewsFeed/);
  assert.match(home, /showDictionary && <EnglishWordExplainer/);
  assert.match(home, /showNews=\{showNews\}/);
  assert.match(navbar, /link.href !== '\/news' \|\| newsEnabled/);
  assert.match(endpoint, /await auth\(\)/);
  assert.match(endpoint, /ownerMutationFilter\(session.user.id/);
  assert.match(endpoint, /Cache-Control': 'private, no-store'/);
});

test('Choose later hides optional tools as well as homepage modules', async () => {
  const wizard = await read('../app/onboarding/onboarding-wizard.js');
  assert.match(wizard, /setModules\(\[\]\); setOptionalFeatures\(\[\]\);/);
  assert.match(wizard, /setModules\(\[\.\.\.DEFAULT_HOME_MODULES\]\); setOptionalFeatures\(\[\.\.\.DEFAULT_OPTIONAL_FEATURES\]\);/);
});
