import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  HOME_MODULES, DEFAULT_HOME_MODULES, parseHomeModules,
  validateHomeModules, homeModuleVisible, homeModuleIdForHref,
} from '../lib/home-modules.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('homepage module catalog has stable unique IDs and safe defaults', () => {
  const ids = HOME_MODULES.map(item => item.id);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(DEFAULT_HOME_MODULES.every(id => ids.includes(id)));
  assert.ok(DEFAULT_HOME_MODULES.length < HOME_MODULES.length);
  assert.deepEqual(parseHomeModules(undefined), null);
  assert.deepEqual(parseHomeModules(['notes', 'notes', 'unsupported', 'airnotes']), ['notes', 'airnotes']);
  assert.deepEqual(parseHomeModules([]), []);
});
test('homepage module validation rejects tampering and supports choosing later', () => {
  assert.equal(validateHomeModules([]), true);
  assert.equal(validateHomeModules(['notes', 'files']), true);
  assert.equal(validateHomeModules(['notes', 'notes']), false);
  assert.equal(validateHomeModules(['notes', 'unknown']), false);
  assert.equal(validateHomeModules('notes'), false);
  assert.equal(validateHomeModules(Array(30).fill('notes')), false);
});
test('legacy users keep modules and explicit selection hides unwanted cards', () => {
  assert.equal(homeModuleVisible(null, 'history'), true);
  assert.equal(homeModuleVisible([], 'notes'), false);
  assert.equal(homeModuleVisible(['notes'], 'notes'), true);
  assert.equal(homeModuleIdForHref('/vault/study'), 'revision');
  assert.equal(homeModuleIdForHref('/revision'), 'revision');
  assert.equal(homeModuleIdForHref('/vault/history'), 'history');
  assert.equal(homeModuleIdForHref('/vault/backup'), 'backup');
});
test('onboarding and Settings persist module choices via owner-scoped actions', async () => {
  const onboarding = await read('../app/onboarding/actions.js');
  const settings = await read('../app/settings/module-actions.js');
  const home = await read('../app/page.js');
  const settingsPage = await read('../app/settings/page.js');
  const dashboard = await read('../app/components/home-dashboard.js');
  assert.match(onboarding, /validateHomeModules\(selectedModules\)/);
  assert.match(onboarding, /homeModules: selectedModules/);
  assert.match(settings, /validateHomeModules\(modules\)/);
  assert.match(settings, /ownerMutationFilter\(session.user.id/);
  assert.match(home, /homeModules: 1/);
  assert.match(home, /homeModuleIdForHref\(module.href\)/);
  assert.match(home, /homeModuleVisible\(homeModules, 'airnotes'\)/);
  assert.match(home, /homeModuleVisible\(homeModules, 'quick-notes'\)/);
  assert.match(settingsPage, /name="homeModule"/);
  assert.match(dashboard, /visible\("links"\)/);
});

test('GitHub storage cannot bypass the homepage module step', async () => {
  const wizard = await read('../app/onboarding/onboarding-wizard.js');
  const action = await read('../app/onboarding/actions.js');
  assert.match(wizard, /step !== 3/);
  assert.match(wizard, /step === 3 && <input type="hidden" name="wizardComplete" value="true"/);
  assert.match(wizard, /step < 3/);
  assert.match(action, /formData\.get\('wizardComplete'\) !== 'true'/);
  const completionGuard = action.indexOf("formData.get('wizardComplete')");
  const gitHubRedirect = action.indexOf("redirect('/vault?setup=onboarding')");
  assert.ok(completionGuard >= 0 && gitHubRedirect > completionGuard);
});

test('module preferences come before storage; the storage submit is the only GitHub handoff', async () => {
  const wizard = await read('../app/onboarding/onboarding-wizard.js');
  const action = await read('../app/onboarding/actions.js');
  const headingModules = wizard.indexOf("['Make your workspace yours'");
  const headingStorage = wizard.indexOf("['Choose where Notes live'");
  assert.ok(headingModules >= 0 && headingStorage > headingModules);
  assert.match(wizard, /step === 2 && <>/);
  assert.match(wizard, /step === 3 && <div className="oge-storage-options">/);
  assert.match(wizard, /step === 3 && <input type="hidden" name="wizardComplete"/);
  assert.match(wizard, /if \(!storage\)/);
  assert.match(action, /homeModules: selectedModules, onboardingComplete: true/);
  assert.ok(action.indexOf('homeModules: selectedModules') < action.indexOf("redirect('/vault?setup=onboarding')"));
});
