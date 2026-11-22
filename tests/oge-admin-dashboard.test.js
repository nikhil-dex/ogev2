import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adminDeletionFailureStatus } from '../lib/oge-admin-delete-status.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Oge admin is a direct-only private route with no navigation link', async () => {
  const page = await read('../app/ogeadmin/page.js');
  const home = await read('../app/page.js');
  const navbar = await read('../app/components/site-navbar.js');
  const settings = await read('../app/settings/page.js');
  assert.match(page, /requireOgeAdmin\(\)/);
  assert.match(page, /if \(!admin\) notFound\(\)/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  for (const source of [home, navbar, settings]) {
    assert.doesNotMatch(source, /ogeadmin/);
  }
});

test('admin authorization checks the authenticated canonical account and env email', async () => {
  const guard = await read('../lib/oge-admin.js');
  const env = await read('../.env.example');
  assert.match(guard, /process\.env\.ADMIN_EMAIL/);
  assert.match(guard, /session\.user\.id/);
  assert.match(guard, /ownerMutationFilter\(session\.user\.id, \{ sessionVersion: session\.user\.sessionVersion \}\)/);
  assert.match(guard, /account\.email\.trim\(\)\.toLowerCase\(\) === expectedEmail/);
  assert.doesNotMatch(guard, /session\.user\.email/);
  assert.match(env, /ADMIN_EMAIL=/);
});

test('account management is limited to session revocation and does not delete user data', async () => {
  const page = await read('../app/ogeadmin/page.js');
  const action = await read('../app/ogeadmin/actions.js');
  assert.match(page, /name="account"/);
  assert.match(page, /name="confirmation" value="REVOKE"/);
  assert.match(page, /type="checkbox" required/);
  assert.match(action, /requireOgeAdmin\(\)/);
  assert.match(action, /targetId === admin\.ownerId/);
  assert.match(action, /target\.email\?\.trim\(\)\.toLowerCase\(\) === admin\.email/);
  assert.match(action, /sessionVersion: randomUUID\(\)/);
  assert.doesNotMatch(action, /deleteOne|deleteMany|drop\(/);
});

test('admin can delete only an eligible non-admin account with explicit email and phrase', async () => {
  const page = await read('../app/ogeadmin/page.js');
  const action = await read('../app/ogeadmin/actions.js');
  const deletion = await read('../lib/account-deletion-transaction.js');
  assert.match(page, /action=\{deleteManagedAccount\}/);
  assert.match(page, /name="targetEmail"/);
  assert.match(page, /name="confirmation" placeholder="DELETE ACCOUNT"/);
  assert.match(action, /confirmation !== 'DELETE ACCOUNT'/);
  assert.match(action, /enteredEmail\.trim\(\)\.toLowerCase\(\) !== email/);
  assert.match(action, /targetId === admin\.ownerId/);
  assert.match(action, /email === admin\.email/);
  assert.match(action, /await deleteAccountDataAtomically\(admin\.db, targetId, version, \{ keepGithubRepository \}\)/);
  assert.match(deletion, /Vault account deletion is disabled/);
  assert.match(deletion, /Vault recovery data exists/);
  assert.match(page, /GitHub repositories are never deleted/);
});

test('admin deletion errors identify the cause rather than show one generic blocker', async () => {
  assert.equal(adminDeletionFailureStatus(new Error('Vault account deletion is disabled until safe cross-store deletion is implemented')), 'vault-connected');
  assert.equal(adminDeletionFailureStatus(new Error('Vault recovery data exists: account deletion requires manual reconciliation')), 'vault-recovery');
  assert.equal(adminDeletionFailureStatus(new Error('Account session changed')), 'conflict');
  assert.equal(adminDeletionFailureStatus(new Error('Transaction numbers are only allowed on a replica set member or mongos')), 'transaction');
  assert.equal(adminDeletionFailureStatus(new Error('unexpected MongoDB error')), 'blocked');
  const action = await read('../app/ogeadmin/actions.js');
  const page = await read('../app/ogeadmin/page.js');
  assert.match(action, /adminDeletionFailureStatus\(error\)/);
  assert.match(page, /'vault-connected':/);
  assert.match(page, /'vault-recovery':/);
});

test('connected GitHub accounts require an explicit keep-repository selection', async () => {
  const action = await read('../app/ogeadmin/actions.js');
  const page = await read('../app/ogeadmin/page.js');
  const transaction = await read('../lib/account-deletion-transaction.js');
  assert.match(page, /name="keepGithubRepository" value="yes"/);
  assert.match(action, /formData\.get\('keepGithubRepository'\) === 'yes'/);
  assert.match(action, /deleted-repo-kept/);
  assert.match(transaction, /connectedVault && !keepGithubRepository/);
  assert.match(transaction, /vault_standalone_drafts/);
  assert.match(transaction, /vaultImportLock/);
  assert.match(transaction, /vault_files', 'vault_file_index_state', 'vault_save_receipts'/);
  assert.match(page, /GitHub repository was left untouched/);
});
