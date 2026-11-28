import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('collapsed launcher supports direct dragging without triggering a click', async () => {
  const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  assert.match(script, /launcher\.addEventListener\('pointerdown'/);
  assert.match(script, /launcher\.setPointerCapture\(event\.pointerId\)/);
  assert.match(script, /launcher\.addEventListener\('pointermove'/);
  assert.match(script, /Math\.hypot\(dx, dy\) < 5/);
  assert.match(script, /ignoreLauncherClick = true/);
  assert.match(script, /if \(ignoreLauncherClick\)/);
  assert.match(script, /placeLauncher\(launcherDrag\.left \+ dx, launcherDrag\.top \+ dy\)/);
  assert.match(script, /launcher\.addEventListener\('click'/);
});

test('floating panel can grow horizontally and vertically with viewport boundaries', async () => {
  const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  assert.match(script, /resize:both/);
  assert.match(script, /Resize widget width and height/);
  assert.match(script, /resize-corner-left/);
  assert.match(script, /panel\.style\.width = width \+ 'px'/);
  assert.match(script, /panel\.style\.height = height \+ 'px'/);
  assert.match(script, /window\.innerWidth - resizeDrag\.left - GAP/);
  assert.match(script, /window\.innerHeight - resizeDrag\.top - GAP/);
  assert.match(script, /window\.addEventListener\('resize'/);
  assert.match(script, /function positionPanel\(\)/);
});

test('idle state fades and user activity restores visibility without hiding tools', async () => {
  const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  assert.match(script, /const IDLE_DELAY_MS = 12000/);
  assert.match(script, /host\.style\.opacity = '1'/);
  assert.match(script, /clearTimeout\(idleTimer\)/);
  assert.match(script, /setTimeout\(\(\) =>/);
  assert.match(script, /panel\.classList\.contains\('hidden'\) \? '\.38' : '\.78'/);
  assert.match(script, /window\.addEventListener\(name, wake, \{ passive: true \}\)/);
  assert.match(script, /document\.addEventListener\('visibilitychange'/);
  assert.match(script, /shadow\.addEventListener\('pointerdown', wake\)/);
  assert.match(script, /prefers-reduced-motion:reduce/);
});

test('compact polish preserves note subject and other floating actions', async () => {
  const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  for (const part of ['id="oge-note-subject"', "send('GET_SUBJECTS')", "send('CREATE_QUICK_NOTE'",
    "send('SAVE_CURRENT_TAB'", "send('GET_PROFILE_LINKS'", "send('VISIT_PROFILE_LINK'",
    "['keydown', 'keyup', 'keypress']"]) {
    assert.ok(script.includes(part), part);
  }
  assert.doesNotMatch(script, /chrome\.storage\.local/);
  assert.doesNotMatch(script, /Authorization: 'Bearer '/);
});

test('expanded toolbelt hides O launcher and restores it on close', async () => {
  const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  assert.match(script, /\.launcher\.is-panel-open\{visibility:hidden;pointer-events:none\}/);
  assert.match(script, /launcher\.classList\.toggle\('is-panel-open', open\)/);
  assert.match(script, /launcher\.setAttribute\('aria-hidden', String\(open\)\)/);
  assert.match(script, /launcher\.tabIndex = open \? -1 : 0/);
  assert.match(script, /panel\.querySelector\('\.close'\)\.addEventListener\('click', \(\) => openPanel\(false\)\)/);
  assert.match(script, /launcher\.addEventListener\('pointerdown'/);
});

test('Saved Links tool has a visible Save page link button using existing API', async () => {
  const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /data-tool="url"/);
  assert.match(script, /data-tool="links" type="button">☷ My links<\/button>/);
  assert.match(script, /data-save-url>＋ Save current page to Saved Links<\/button>/);
  // M97 used the previously reserved third tool slot for Learning Tracks.
  assert.match(script, /data-tool="tracks" type="button" hidden>▷ Tracks<\/button>/);
  assert.match(script, /data-save-track>Create learning track<\/button>/);
  assert.match(script, /urlSave\.addEventListener\('click', async \(\) =>/);
  assert.match(script, /send\('SAVE_CURRENT_TAB'\)/);
  assert.match(script, /Page link saved to Saved Links/);
});


test('expanded panel overlays the collapsed O footprint without reserving a launcher gap', async () => {
  const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  assert.match(script, /const y = clamp\(launcherBounds\.bottom - height, GAP, window\.innerHeight - height - GAP\)/);
  assert.match(script, /panel\.style\.top = y \+ 'px'/);
  assert.doesNotMatch(script, /bottom:54px/);
  assert.doesNotMatch(script, /const above = launcherBounds\.top - height - GAP/);
  assert.match(script, /launcher\.classList\.toggle\('is-panel-open', open\)/);
});

test('theme comes only from connected Oge page and updates live across tabs', async () => {
  const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../extension/service-worker.js', import.meta.url), 'utf8');
  assert.match(script, /send\('GET_THEME'\)/);
  assert.match(script, /state\.isOgePage/);
  assert.match(script, /document\.documentElement\.dataset\.theme/);
  assert.match(script, /new MutationObserver\(sync\)/);
  assert.match(script, /chrome\.storage\.onChanged\.addListener/);
  assert.match(script, /host\.dataset\.ogeTheme/);
  assert.match(script, /:host\(\[data-oge-theme="dark"\]\)/);
  assert.match(worker, /'GET_THEME'/);
  assert.match(worker, /'SET_THEME'/);
  assert.match(worker, /new URL\(sender\.tab\.url\)\.origin !== origin/);
  assert.match(worker, /chrome\.storage\.local\.set\(\{ ogeTheme: message\.theme \}\)/);
});


test('header one-tap position button cycles clockwise starting top right', async () => {
  const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  assert.match(script, /class="corner-button" type="button"/);
  assert.match(script, /aria-label="Move widget to top-right corner"/);
  assert.match(script, /const CORNERS = \['top-right', 'bottom-right', 'bottom-left', 'top-left'\]/);
  assert.match(script, /nextCornerIndex = \(nextCornerIndex \+ 1\) % CORNERS\.length/);
  assert.match(script, /cornerButton\.addEventListener\('click'/);
  assert.match(script, /function placeSnappedCorner\(\)/);
  assert.match(script, /snappedCorner\.endsWith\('right'\)/);
  assert.match(script, /snappedCorner\.startsWith\('bottom'\)/);
  assert.match(script, /if \(snappedCorner\) \{ placeSnappedCorner\(\); return; \}/);
  assert.match(script, /if \(snappedCorner\) placeSnappedCorner\(\)/);
  assert.match(script, /function placeLauncher\(x, y\) \{\s*snappedCorner = null/);
  assert.match(script, /cornerButton\.setAttribute\('aria-label', 'Move widget to ' \+ next \+ ' corner'\)/);
});

test('typing in focused widget resets idle clock before page shortcuts are stopped', async () => {
  const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  const idle = script.slice(script.indexOf('  let idleTimer;'), script.indexOf('  function openPanel(open)'));
  const shortcuts = script.slice(script.indexOf('  const stopPageShortcutsWhileTyping ='), script.indexOf('  // Header movement'));
  const listeners = new Map();
  const shadowListeners = new Map();
  let now = 0, nextId = 0, hidden = false;
  const pending = new Map();
  const host = { style: {} };
  const shadow = { activeElement: { matches: () => true }, addEventListener: (name, fn) => {
    const list = shadowListeners.get(name) || []; list.push(fn); shadowListeners.set(name, list);
  } };
  const context = { host, shadow, panel: { classList: { contains: () => hidden } },
    window: { addEventListener: (name, fn, options) => {
      const list = listeners.get(name) || []; list.push({ fn, capture: options === true }); listeners.set(name, list);
    } },
    document: { addEventListener() {}, hidden: false },
    setTimeout: (fn, delay) => { const id = ++nextId; pending.set(id, { fn, at: now + delay }); return id; },
    clearTimeout: id => pending.delete(id),
  };
  vm.runInNewContext(idle + shortcuts + '\nwake();', context);
  const advance = ms => {
    const until = now + ms;
    while (true) {
      const next = [...pending.entries()].sort((a,b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > until) break;
      now = next[1].at; pending.delete(next[0]); next[1].fn();
    }
    now = until;
  };
  const type = () => {
    let stopped = false;
    const event = { stopPropagation() {}, stopImmediatePropagation() { stopped = true; } };
    for (const listener of [...listeners.get('keydown')].sort((a,b) => Number(b.capture) - Number(a.capture))) {
      if (stopped) break;
      listener.fn(event);
    }
    assert.equal(stopped, true);
  };
  for (let i = 0; i < 4; i++) { advance(10000); type(); assert.equal(host.style.opacity, '1'); }
  advance(11999); assert.equal(host.style.opacity, '1');
  advance(1); assert.equal(host.style.opacity, '.78');
  shadowListeners.get('input').forEach(fn => fn());
  assert.equal(host.style.opacity, '1');
  shadowListeners.get('compositionstart').forEach(fn => fn());
  advance(24000); assert.equal(host.style.opacity, '1');
  shadowListeners.get('compositionend').forEach(fn => fn());
  advance(12000); assert.equal(host.style.opacity, '.78');
  hidden = true;
  vm.runInNewContext('wake()', context);
  advance(12000); assert.equal(host.style.opacity, '.38');
});
