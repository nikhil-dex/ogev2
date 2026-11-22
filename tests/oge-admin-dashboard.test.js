import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
