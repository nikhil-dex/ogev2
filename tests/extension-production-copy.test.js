import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
test('public extension setup does not default to a developer host or specific subject', async () => {
 const [popup, script, content, page, setup, manifestText] = await Promise.all(['extension/popup.html','extension/popup.js','extension/content.js','app/learning-tracks/page.js','app/extension/page.js','extension/manifest.json'].map(read));
 assert.doesNotMatch(popup, /localhost|127\.0\.0\.1/);
 assert.doesNotMatch(script, /baseUrl\.value\s*=\s*['"]http:\/\/localhost/);
 assert.match(script, /baseUrl\.value = ''/);
 assert.match(script, /if \(!saved\.baseUrl \|\| !saved\.token\) showTool\('connect'\)/);
 assert.doesNotMatch(content + page, /placeholder="Machine learning course"/i);
 assert.doesNotMatch(setup, /localhost|127\.0\.0\.1/);
 assert.match(setup, /writeText\(window\.location\.origin\)/);
 const manifest = JSON.parse(manifestText);
 assert.ok(!manifest.host_permissions?.length);
 assert.ok(manifest.optional_host_permissions.includes('https://*/*'));
 assert.ok(manifest.optional_host_permissions.includes('http://localhost/*'));
});
