(() => {
  // Render the Tracks controls only after the connected server accepts the list request.
  const LEARNING_TRACKS_EXTENSION_PREVIEW = true;
  if (window.top !== window || document.getElementById('oge-floating-toolbelt-host')) return;
  const host = document.createElement('div');
  host.id = 'oge-floating-toolbelt-host';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;right:18px;bottom:18px;opacity:1;transition:opacity .45s ease';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = [
    '*{box-sizing:border-box}button,textarea,select,input{font:inherit}',
    'button,textarea,select,input{outline-offset:2px}@media(prefers-reduced-motion:reduce){:host{transition:none!important}}',
    '.launcher{width:44px;height:44px;border:1px solid #ffffff55;border-radius:14px;background:#316b50;color:#fff;box-shadow:0 8px 26px #10251b40;font:800 19px system-ui;cursor:grab;touch-action:none;user-select:none;letter-spacing:-.05em;transition:box-shadow .18s,background .18s}.launcher:hover{background:#23563d;box-shadow:0 9px 28px #10251b55}.launcher:active{cursor:grabbing}.launcher.is-panel-open{visibility:hidden;pointer-events:none}',
    '.panel{position:fixed;left:16px;top:16px;right:auto;bottom:auto;width:330px;min-width:265px;max-width:calc(100vw - 24px);height:360px;min-height:235px;max-height:calc(100vh - 75px);resize:both;overflow:auto;border:1px solid #dbe5de;border-radius:14px;background:#fff;color:#1d2d22;box-shadow:0 18px 48px #10251b35;font:12px/1.4 system-ui,-apple-system,sans-serif}',
    '.hidden{display:none}.resize-corner{position:sticky;bottom:0;float:right;width:24px;height:24px;margin-top:-24px;display:grid;place-items:center;border:0;border-top-left-radius:8px;color:#657a6d;background:#f1f6f2;cursor:nwse-resize;touch-action:none;user-select:none;font-size:15px}.resize-corner-left{float:left;border-radius:0 8px 0 0;cursor:nesw-resize}.top{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #e8eee9;cursor:grab;touch-action:none;user-select:none;background:#fbfcfb}.top:active{cursor:grabbing}',
    '.mark{display:grid;place-items:center;width:24px;height:24px;border-radius:7px;background:#316b50;color:white;font-size:12px;font-weight:800}.heading{flex:1;font-size:12px;font-weight:750;letter-spacing:.01em}',
    ' .corner-button{display:grid;place-items:center;width:27px;height:27px;flex:0 0 auto;padding:0;border:1px solid #dbe5de;border-radius:7px;background:transparent;color:#536c59;font-size:16px;cursor:pointer}.corner-button:hover{background:#eaf1ec;color:#245b38}.close{padding:2px 6px;border:0;background:transparent;color:#536c59;font-size:22px;cursor:pointer}',
    '.body{padding:11px 12px}.body[hidden]{display:none}.hint{margin:0 0 9px;color:#6b7b70;font-size:10px;line-height:1.45}',
    'textarea{display:block;width:100%;height:116px;min-height:75px;padding:10px;resize:vertical;border:1px solid #d5e0d8;border-radius:8px;color:#15251b;background:#fff;font:12px/1.5 ui-monospace,monospace;outline-color:#40795e}',
    '.primary{display:block;width:100%;margin-top:9px;padding:9px;border:0;border-radius:8px;background:#316b50;color:white;font-size:11px;font-weight:750;cursor:pointer}.primary:hover{background:#23563d}',
    '.body [data-open-saved-vault-note],.body [data-new-vault-note]{display:block;width:100%;margin-top:6px;padding:8px;border:1px solid #b6d8bf;border-radius:8px;background:#e9f5ec;color:#245b38;font-size:11px;cursor:pointer}.body [data-open-saved-vault-note][hidden],.body [data-new-vault-note][hidden]{display:none}',
    'button:disabled{opacity:.65;cursor:wait}.status{min-height:0;margin:0 12px;color:#316b50;font-size:10px;overflow-wrap:anywhere}.status:not(:empty){padding:6px 0}.error{color:#b42318}',
    '.belt{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;padding:7px 10px;border-top:1px solid #e7eee8;background:#fafcfb}',
    '.belt.tracks-enabled{grid-template-columns:repeat(3,1fr)}.belt button[hidden]{display:none}',
    '.belt button{padding:7px 2px;border:1px solid transparent;border-radius:7px;background:transparent;color:#52685a;font-size:10px;font-weight:600;cursor:pointer}',
    '.belt button.selected{border-color:#b6d8bf;background:#e5f3e9;color:#275d39}',
    '.link{display:grid;gap:8px;padding:9px 0;border-bottom:1px solid #e4eee6}.link:last-child{border:0}.link strong{font-size:12px}',
    '.address{display:block;color:#6c7b71;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.link-actions{display:flex;gap:8px}.link-actions button{flex:1;padding:8px;border:1px solid #a9c7b1;border-radius:7px;background:#eff7f0;color:#255837;font-size:11px;cursor:pointer}',
    ':host([data-oge-theme="dark"]){color-scheme:dark}'+
    ':host([data-oge-theme="dark"]) .panel{background:#171d19;color:#e4ebe6;border-color:#303b35;box-shadow:0 18px 48px #0008}'+
    ':host([data-oge-theme="dark"]) .top,:host([data-oge-theme="dark"]) .belt{background:#202b24;border-color:#303b35}'+
    ':host([data-oge-theme="dark"]) .launcher,:host([data-oge-theme="dark"]) .mark,:host([data-oge-theme="dark"]) .primary{background:#78ad8d;color:#15251b}'+
    ':host([data-oge-theme="dark"]) .primary:hover,:host([data-oge-theme="dark"]) .launcher:hover{background:#649a79}'+
    ':host([data-oge-theme="dark"]) .hint,:host([data-oge-theme="dark"]) .empty,:host([data-oge-theme="dark"]) .subject-label,:host([data-oge-theme="dark"]) .address,:host([data-oge-theme="dark"]) .close{color:#a2afa7}'+
    ':host([data-oge-theme="dark"]) textarea,:host([data-oge-theme="dark"]) input,:host([data-oge-theme="dark"]) .subject-select{background:#222e26;color:#e4ebe6;border-color:#3b4d40}'+
    ':host([data-oge-theme="dark"]) .belt button{color:#b8c8bd}'+
    ':host([data-oge-theme="dark"]) .belt button.selected,:host([data-oge-theme="dark"]) .link-actions button{background:#293c30;color:#a9d3b8;border-color:#44654d}'+
    ':host([data-oge-theme="dark"])  .link{border-color:#303b35}'+
    ':host([data-oge-theme="dark"]) .resize-corner{background:#27372d;color:#bad2c0}'+
    ':host([data-oge-theme="dark"]) .status{color:#a9d3b8}',
    ':host([data-oge-theme="dark"]) .corner-button{color:#a2afa7;border-color:#3b4d40}'+
    ':host([data-oge-theme="dark"]) .corner-button:hover{background:#293c30;color:#e4ebe6}',
    '.note-more{display:block;margin:7px 0 0 auto;padding:6px 9px;border:1px solid #b6d8bf;border-radius:7px;background:#e9f5ec;color:#245b38;font-size:11px;cursor:pointer}.note-more[hidden],[data-existing-note-picker][hidden]{display:none}.note-more:hover{background:#dcefe0}:host([data-oge-theme="dark"]) .note-more{background:#293c30;color:#a9d3b8;border-color:#44654d}.track-input{width:100%;padding:8px;margin:5px 0 8px;border:1px solid #d5e0d8;border-radius:8px;background:#fff;color:#15251b;font:11px system-ui}.empty{font-size:11px;color:#637568}.subject-label{display:block;margin:8px 0 4px;font-size:10px;font-weight:700;color:#546d5b}.subject-select{display:block;width:100%;padding:8px;border:1px solid #d5e0d8;border-radius:8px;background:#fff;color:#15251b;font:11px system-ui}:focus-visible{outline:2px solid #40795e;outline-offset:2px}',
    '[data-panel="tracks"]{--track-bg:#f7faf7;--track-card:#fff;--track-border:#dbe5de;--track-muted:#637568;--track-accent:#316b50;--track-soft:#e9f5ec;--track-on-accent:#fff;padding:12px;min-width:0}',
    ':host([data-oge-theme="dark"]) [data-panel="tracks"]{--track-bg:#202b24;--track-card:#1c261f;--track-border:#3b4d40;--track-muted:#a2afa7;--track-accent:#a9d3b8;--track-soft:#293c30;--track-on-accent:#15251b}',
    '[data-panel="tracks"] .track-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}',
    '[data-panel="tracks"] .track-section-head h2{margin:0;font-size:13px;font-weight:750;letter-spacing:-.02em}',
    '[data-panel="tracks"] .track-kicker{display:block;color:var(--track-muted);font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin:0 0 2px}',
    '[data-panel="tracks"] [data-refresh-tracks]{margin:0;flex-shrink:0}',
    '[data-panel="tracks"] [data-track-list]{display:grid;gap:9px}',
    '[data-panel="tracks"] .track-card{display:grid;gap:9px;padding:11px;border:1px solid var(--track-border);border-radius:10px;background:var(--track-card);min-width:0}',
    '[data-panel="tracks"] .track-card.is-current{border-color:var(--track-accent)}',
    '[data-panel="tracks"] .track-card-title{font-size:12px;line-height:1.4;font-weight:750;overflow-wrap:anywhere}',
    '[data-panel="tracks"] .track-subject{display:block;color:var(--track-muted);font-size:10px;overflow-wrap:anywhere}',
    '[data-panel="tracks"] .track-current-label{font-size:9px;font-weight:700;color:var(--track-accent);letter-spacing:.06em;text-transform:uppercase}',
    '[data-panel="tracks"] .track-progress{display:grid;gap:5px;padding:8px;border-radius:7px;background:var(--track-bg)}',
    '[data-panel="tracks"] .track-progress-text{font-size:10px;color:var(--track-muted);overflow-wrap:anywhere}',
    '[data-panel="tracks"] .track-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,96px),1fr));gap:6px}',
    '[data-panel="tracks"] .track-actions button,[data-panel="tracks"] [data-open-learning-tracks]{min-width:0;min-height:32px;padding:7px 5px;border:1px solid var(--track-border);border-radius:7px;background:var(--track-card);color:inherit;font-size:10px;font-weight:650;line-height:1.35;white-space:normal;overflow-wrap:anywhere;cursor:pointer}',
    '[data-panel="tracks"] .track-actions button:hover:not(:disabled),[data-panel="tracks"] [data-open-learning-tracks]:hover{background:var(--track-soft);border-color:var(--track-accent);color:var(--track-accent)}',
    '[data-panel="tracks"] .track-actions .track-complete{grid-column:1/-1;background:var(--track-accent);border-color:var(--track-accent);color:var(--track-on-accent);font-weight:750}',
    '[data-panel="tracks"] .track-actions .track-complete:hover:not(:disabled){background:var(--track-accent);color:var(--track-on-accent);filter:brightness(.93)}',
    '[data-panel="tracks"] .track-actions .track-note{grid-column:1/-1;background:var(--track-soft);color:var(--track-accent)}',
    '[data-panel="tracks"] .track-empty{padding:13px 10px;text-align:center;border:1px dashed var(--track-border);border-radius:9px;background:var(--track-bg);color:var(--track-muted);margin:0;font-size:11px}',
    '[data-panel="tracks"] .track-create{margin-top:12px;padding:11px;border:1px solid var(--track-border);border-radius:10px;background:var(--track-bg)}',
    '[data-panel="tracks"] .track-create h3{margin:0 0 5px;font-size:12px;font-weight:750}',
    '[data-panel="tracks"] .track-create .hint{color:var(--track-muted);margin:5px 0 8px}',
    '[data-panel="tracks"] .track-input,[data-panel="tracks"] [data-track-subject]{display:block;width:100%;min-width:0;margin:4px 0 0;padding:8px;border:1px solid var(--track-border);border-radius:7px;background:var(--track-card);color:inherit;font-size:11px}',
    '[data-panel="tracks"] .track-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,105px),1fr));gap:8px}',
    '[data-panel="tracks"] .track-create .subject-label{min-width:0;margin:7px 0 0}',
    '[data-panel="tracks"] [data-open-learning-tracks]{display:block;width:100%;margin-top:9px;background:transparent;color:var(--track-accent)}',
    '[data-panel="tracks"] button:focus-visible,[data-panel="tracks"] input:focus-visible,[data-panel="tracks"] select:focus-visible{outline:2px solid var(--track-accent);outline-offset:2px}',
    '.timer-toggle{display:flex;align-items:center;gap:4px;min-width:27px;height:27px;padding:0 6px;border:1px solid #dbe5de;border-radius:7px;background:transparent;color:#316b50;font:650 10px system-ui;cursor:pointer;font-variant-numeric:tabular-nums}',
    '.timer-toggle[aria-expanded="true"],.timer-toggle.is-running{background:#e5f3e9;border-color:#b6d8bf}.timer-toggle svg{width:13px;height:13px;flex:none}.timer-toggle span:empty{display:none}',
    '.study-timer{margin:9px 12px 0;padding:10px;border:1px solid #dbe5de;border-radius:10px;background:#f7faf7;display:grid;gap:7px}.study-timer[hidden]{display:none}',
    '.timer-head{display:flex;align-items:center;justify-content:space-between;gap:6px}.timer-head strong{font-size:11px}.timer-readout{font:750 26px/1.2 system-ui;font-variant-numeric:tabular-nums;letter-spacing:-.035em;color:#316b50;text-align:center}',
    '.timer-detail{margin:0;text-align:center;font-size:10px;color:#637568}.timer-goal{display:flex;align-items:center;gap:7px;font-size:10px}.timer-goal input{width:64px;min-width:0;padding:5px;border:1px solid #d5e0d8;border-radius:6px;background:#fff;color:inherit}',
    '.timer-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.timer-actions button{padding:7px;border:1px solid #b6d8bf;border-radius:7px;background:#fff;color:#316b50;font-size:11px;font-weight:650;cursor:pointer}.timer-actions [data-timer-start]{background:#316b50;color:#fff}.timer-actions [data-timer-reset]{background:transparent}',
    ':host([data-oge-theme="dark"]) .timer-toggle{color:#a9d3b8;border-color:#3b4d40}:host([data-oge-theme="dark"]) .timer-toggle[aria-expanded="true"],:host([data-oge-theme="dark"]) .timer-toggle.is-running{background:#293c30;border-color:#44654d}',
    ':host([data-oge-theme="dark"]) .study-timer{background:#202b24;border-color:#3b4d40}:host([data-oge-theme="dark"]) .timer-readout{color:#a9d3b8}:host([data-oge-theme="dark"]) .timer-detail{color:#a2afa7}:host([data-oge-theme="dark"]) .timer-actions button{background:#293c30;border-color:#44654d;color:#a9d3b8}:host([data-oge-theme="dark"]) .timer-actions [data-timer-start]{background:#78ad8d;color:#15251b}',
  ].join('');
  const panel = document.createElement('section');
  panel.className = 'panel hidden';
  panel.setAttribute('aria-label', 'OgeNotes floating toolbelt');
  // HTML is static extension-owned markup; user content uses textContent.
  panel.innerHTML = [
    '<header class="top"><span class="mark">O</span><strong class="heading">OgeNotes</strong><button class="timer-toggle" type="button" data-timer-toggle aria-label="Study timer" aria-expanded="false" title="Study timer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3"/></svg><span data-timer-mini></span></button><button class="corner-button" type="button" aria-label="Move widget to top-right corner" title="Move to top-right corner">⌖</button><button class="close" type="button" aria-label="Close toolbelt">×</button></header>',
    '<section class="study-timer" data-study-timer hidden aria-label="Study timer"><div class="timer-head"><strong>Study timer</strong><span data-timer-state>Ready</span></div><div class="timer-readout" data-timer-readout role="timer">00:00:00</div><p class="timer-detail" data-timer-detail>Time studied</p><label class="timer-goal">Target (minutes)<input data-timer-goal type="number" min="0" max="1440" value="0" step="1"><span>0 = stopwatch</span></label><div class="timer-actions"><button type="button" data-timer-start>Start</button><button type="button" data-timer-reset>Reset</button></div><p class="timer-detail" data-timer-error role="status"></p></section>',
    '<div class="body" data-panel="note"><p class="hint">Write a quick thought, or a title followed by details. Choose a destination below.</p><textarea maxlength="20000" aria-label="Quick note" placeholder="Write a thought, or a title&#10;&#10;Your note…"></textarea><p class="hint" data-lesson-context hidden></p><label class="subject-label" data-lesson-timestamp hidden><input type="checkbox" data-attach-timestamp> Attach current video timestamp</label><button type="button" class="note-more" data-manual-destination hidden>Choose destination manually</button><button type="button" class="note-more" data-auto-destination hidden>Use current lesson Note</button><label class="subject-label" for="oge-note-subject">Save to</label><select class="subject-select" id="oge-note-subject" aria-label="Choose note destination"><option value="">Quick Notes (default)</option></select><div data-existing-note-picker hidden><label class="subject-label" for="oge-target-note">Note</label><select class="subject-select" id="oge-target-note" aria-label="Choose existing note"><option value="">Default (new Note)</option></select><button type="button" class="note-more" data-show-more-notes hidden>Show more</button></div><button class="primary" type="button" data-save-note>Save to Quick Notes</button><button type="button" data-new-vault-note hidden>Save this as a separate Note instead</button><button type="button" data-open-saved-vault-note hidden>View last saved GitHub Note ↗</button></div>',
    '<div class="body" data-panel="links" hidden><p class="hint">Your GitHub, LinkedIn and portfolio links.</p><div data-links><p class="empty">Open My Links to load URLs.</p></div><button class="primary" type="button" data-save-url>＋ Save current page to Saved Links</button></div>',
    ...(LEARNING_TRACKS_EXTENSION_PREVIEW ? [
    '<div class="body" data-panel="tracks" hidden><div class="track-section-head"><div><span class="track-kicker">Learning</span><h2>Your tracks</h2></div><button type="button" class="note-more" data-refresh-tracks>Refresh tracks</button></div><div data-track-list aria-live="polite"></div><section class="track-create"><span class="track-kicker">New playlist</span><h3>Create a track</h3><p class="hint">Open a YouTube playlist or a video inside one.</p><label class="subject-label">Track name<input class="track-input" data-track-title maxlength="120" placeholder="Machine learning course"></label><div class="track-fields"><label class="subject-label">Videos per day<input class="track-input" data-track-daily type="number" min="1" max="20" value="2"></label><label class="subject-label">Notes subject<select data-track-subject><option value="">Unassigned</option></select></label></div><p class="hint">Total videos are detected automatically from YouTube when you create the track.</p><button class="primary" type="button" data-save-track>Create learning track</button></section><button type="button" data-open-learning-tracks>Open Learning Tracks in Oge ↗</button></div>',
    ] : []),
    '<p class="status" role="status" aria-live="polite"></p>',
    '<nav class="belt" aria-label="OgeNotes tools"><button class="selected" data-tool="note" type="button">✎ Quick note</button><button data-tool="links" type="button">☷ My links</button>' + (LEARNING_TRACKS_EXTENSION_PREVIEW ? '<button data-tool="tracks" type="button" hidden>▷ Tracks</button>' : '') + '</nav>',
    '<button class="resize-corner resize-corner-left" type="button" aria-label="Resize widget from left corner" title="Drag left or down to resize">↙</button>',
    '<button class="resize-corner" type="button" aria-label="Resize widget width and height" title="Drag to resize width and height">↘</button>',
  ].join('');
  const launcher = document.createElement('button');
  launcher.className = 'launcher';
  launcher.type = 'button';
  launcher.textContent = 'O';
  launcher.title = 'Open OgeNotes floating toolbelt';
  launcher.setAttribute('aria-label', 'Open OgeNotes floating toolbelt');
  launcher.setAttribute('aria-expanded', 'false');
  shadow.append(style, panel, launcher);
  // Oge stores its theme on <html data-theme="...">. Only the connected
  // Oge origin can publish theme changes; other websites consume them.
  async function initOgeTheme() {
    try {
      const state = await send('GET_THEME');
      host.dataset.ogeTheme = state.theme === 'light' ? 'light' : 'dark';
      if (state.isOgePage) {
        const sync = () => {
          const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
          host.dataset.ogeTheme = theme;
          void send('SET_THEME', { theme }).catch(() => {});
        };
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      }
    } catch { host.dataset.ogeTheme = 'dark'; }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.ogeTheme) {
      host.dataset.ogeTheme = changes.ogeTheme.newValue === 'light' ? 'light' : 'dark';
    }
  });
  void initOgeTheme();

  const note = panel.querySelector('textarea');
  const subjectSelect = panel.querySelector('#oge-note-subject');
  const notePicker = panel.querySelector('[data-existing-note-picker]');
  const noteSelect = panel.querySelector('#oge-target-note');
  const noteMore = panel.querySelector('[data-show-more-notes]');
  const status = panel.querySelector('.status');
  let active = 'note';
  const setStatus = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle('error', error);
  };
  async function send(type, data = {}) {
    const response = await chrome.runtime.sendMessage({ type, ...data });
    if (!response?.ok) throw new Error(response?.error || 'Could not reach OgeNotes.');
    return response;
  }
  // Timer is independent of the active tool and of the Oge account connection.
  const timerToggle = panel.querySelector('[data-timer-toggle]');
  const timerBox = panel.querySelector('[data-study-timer]');
  const timerMini = panel.querySelector('[data-timer-mini]');
  const timerGoal = panel.querySelector('[data-timer-goal]');
  const timerStart = panel.querySelector('[data-timer-start]');
  const timerReset = panel.querySelector('[data-timer-reset]');
  const timerError = panel.querySelector('[data-timer-error]');
  let timerState = null, timerBusy = false, timerVersion = 0, timerInterval = null;
  let claimingToast = false, toastHost = null, toastTimeout = null, toastSession = null;
  const timerFormat = ms => {
    const seconds = Math.floor(Math.max(0, ms) / 1000);
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
  };
  function dismissStudyToast() {
    if (toastTimeout !== null) clearTimeout(toastTimeout);
    toastTimeout = null;
    toastHost?.remove();
    toastHost = null;
    toastSession = null;
  }
  function studyCompletionChime() {
    // Web audio is best effort: browsers can block playback before user interaction.
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      const context = new Audio();
      const close = () => { void context.close().catch(() => {}); };
      if (context.state !== 'running') { close(); return; }
      const start = context.currentTime;
      for (const [index, frequency] of [523.25, 659.25, 783.99].entries()) {
        const tone = context.createOscillator();
        const gain = context.createGain();
        const at = start + index * .12;
        tone.type = 'sine';
        tone.frequency.value = frequency;
        gain.gain.setValueAtTime(.001, at);
        gain.gain.exponentialRampToValueAtTime(.065, at + .025);
        gain.gain.exponentialRampToValueAtTime(.001, at + .28);
        tone.connect(gain); gain.connect(context.destination);
        tone.start(at); tone.stop(at + .29);
        if (index === 2) tone.onended = close;
      }
    } catch { /* Visual notification remains available. */ }
  }
  function showStudyToast(state) {
    dismissStudyToast();
    toastSession = state.sessionId;
    const element = document.createElement('div');
    toastHost = element;
    element.style.cssText = 'all:initial;position:fixed;top:16px;right:16px;width:360px;max-width:calc(100vw - 32px);z-index:2147483647;display:block;pointer-events:auto';
    const root = element.attachShadow({ mode: 'closed' });
    const css = document.createElement('style');
    css.textContent = [
      '*{box-sizing:border-box}button{font:inherit;cursor:pointer}',
      '.toast{--bg:#fff;--fg:#222;--muted:#686868;--line:#e0e0e0;--accent:#23794b;--action:#262626;--on:#fff;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:0 8px 32px #0002;font:13px/1.45 system-ui,-apple-system,sans-serif;animation:appear .2s ease-out}',
      ':host([data-theme="dark"]) .toast{--bg:#242424;--fg:#f4f4f4;--muted:#b5b5b5;--line:#454545;--accent:#82c7a0;--action:#f4f4f4;--on:#222;box-shadow:0 8px 32px #0006}',
      '.head{display:flex;align-items:flex-start;gap:10px}.mark{color:var(--accent);flex:none;width:21px;height:21px}.copy{flex:1;min-width:0}.copy strong{font-size:13px}.copy p{margin:4px 0 0;color:var(--muted);font-size:12px}',
      '.close{border:0;background:transparent;color:var(--muted);font-size:19px;line-height:1;padding:2px 5px}.actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:7px;margin-top:13px}.actions button{padding:7px 12px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--fg);font-size:12px;font-weight:600}.actions .reuse{background:var(--action);color:var(--on);border-color:var(--action)}button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}button:disabled{opacity:.6;cursor:wait}',
      '.error{font-size:11px;color:var(--muted);margin:7px 0 0}.error:empty{display:none}@keyframes appear{from{opacity:0;transform:translateY(-7px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.toast{animation:none}}'
    ].join('');
    const card = document.createElement('section');
    card.className = 'toast';
    card.setAttribute('aria-label', 'Study session completed');
    card.innerHTML = '<div class="head"><svg class="mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg><div class="copy" role="status" aria-live="polite"><strong>Study session completed</strong><p data-toast-message></p></div><button type="button" class="close" aria-label="Dismiss notification">×</button></div><div class="actions"><button type="button" data-toast-reset>Reset</button><button type="button" class="reuse" data-toast-reuse>Reuse timer</button></div><p class="error" role="status"></p>';
    element.dataset.theme = host.dataset.ogeTheme === 'light' ? 'light' : 'dark';
    card.querySelector('[data-toast-message]').textContent = 'You studied for ' + state.goalMinutes + (state.goalMinutes === 1 ? ' minute.' : ' minutes.') + ' Time for a break.';
    root.append(css, card);
    document.documentElement.append(element);
    card.querySelector('.close').addEventListener('click', dismissStudyToast);
    const apply = async action => {
      const buttons = [...card.querySelectorAll('button')];
      buttons.forEach(button => { button.disabled = true; });
      try {
        const result = await send('STUDY_TIMER', { action, sessionId: state.sessionId });
        timerState = result.timer;
        timerGoal.dataset.loaded = '';
        renderStudyTimer();
        if (toastHost === element) dismissStudyToast();
      } catch (error) {
        card.querySelector('.error').textContent = error.message || 'Could not update timer.';
        buttons.forEach(button => { button.disabled = false; });
      }
    };
    card.querySelector('[data-toast-reset]').addEventListener('click', () => void apply('toast-reset'));
    card.querySelector('[data-toast-reuse]').addEventListener('click', () => void apply('toast-reuse'));
    element.addEventListener('pointerenter', () => { if (toastTimeout !== null) clearTimeout(toastTimeout); toastTimeout = null; });
    element.addEventListener('pointerleave', () => { if (!root.activeElement) toastTimeout = setTimeout(dismissStudyToast, 10000); });
    root.addEventListener('focusin', () => { if (toastTimeout !== null) clearTimeout(toastTimeout); toastTimeout = null; });
    root.addEventListener('focusout', () => { if (toastTimeout === null) toastTimeout = setTimeout(dismissStudyToast, 10000); });
    root.addEventListener('keydown', event => { if (event.key === 'Escape') dismissStudyToast(); });
    toastTimeout = setTimeout(dismissStudyToast, 10000);
    studyCompletionChime();
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'SHOW_STUDY_COMPLETION' || sender.id !== chrome.runtime.id) return false;
    if (document.hidden || !document.hasFocus()) { respond({ shown: false }); return false; }
    const completed = message.timer;
    if (!completed || !Number.isInteger(completed.goalMinutes) || completed.goalMinutes < 1 ||
        completed.elapsedMs < completed.goalMinutes * 60000) { respond({ shown: false }); return false; }
    if (toastSession !== completed.sessionId) showStudyToast(completed);
    respond({ shown: true });
    return false;
  });
  async function maybeShowStudyToast() {
    if (claimingToast || !timerState || timerState.notified || document.hidden || !document.hasFocus()) return;
    const elapsed = timerState.elapsedMs + (timerState.startedAt === null ? 0 : Math.max(0, Date.now() - timerState.startedAt));
    if (!timerState.goalMinutes || elapsed < timerState.goalMinutes * 60000) return;
    claimingToast = true;
    try {
      const result = await send('STUDY_TIMER', { action: 'claim' });
      timerState = result.timer;
      if (result.claimed) showStudyToast(result.timer);
      renderStudyTimer();
    } catch { /* Retry on focus or when opening the timer. */ }
    finally { claimingToast = false; }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void maybeShowStudyToast(); });
  window.addEventListener('focus', () => void maybeShowStudyToast());
  function renderStudyTimer() {
    if (!timerState) { timerStart.disabled = timerReset.disabled = timerGoal.disabled = true; return; }
    const goal = timerState.goalMinutes * 60000;
    const raw = timerState.elapsedMs + (timerState.startedAt === null ? 0 : Math.max(0, Date.now() - timerState.startedAt));
    const elapsed = goal ? Math.min(raw, goal) : raw;
    const finished = goal > 0 && elapsed >= goal;
    const running = timerState.startedAt !== null && !finished;
    const shown = goal ? goal - elapsed : elapsed;
    const clock = timerFormat(goal ? Math.ceil(shown / 1000) * 1000 : shown);
    panel.querySelector('[data-timer-readout]').textContent = clock;
    panel.querySelector('[data-timer-state]').textContent = finished ? 'Finished' : running ? 'Running' : elapsed ? 'Paused' : 'Ready';
    panel.querySelector('[data-timer-detail]').textContent = goal ? 'Studied ' + timerFormat(elapsed) : 'Time studied';
    timerMini.textContent = running || elapsed ? clock : '';
    timerToggle.classList.toggle('is-running', running);
    timerStart.textContent = running ? 'Pause' : finished ? 'Reuse' : elapsed ? 'Resume' : 'Start';
    timerStart.disabled = timerReset.disabled = timerBusy;
    timerGoal.disabled = timerBusy || running || elapsed > 0;
    if (timerGoal !== shadow.activeElement && (timerGoal.disabled || timerGoal.dataset.loaded !== 'yes')) {
      timerGoal.value = String(timerState.goalMinutes);
      timerGoal.dataset.loaded = 'yes';
    }
    if (running && timerInterval === null) timerInterval = setInterval(renderStudyTimer, 250);
    else if (!running && timerInterval !== null) { clearInterval(timerInterval); timerInterval = null; }
    if (toastHost && (timerState.sessionId !== toastSession || !finished)) dismissStudyToast();
    if (finished) void maybeShowStudyToast();
  }
  async function timerAction(action, goalMinutes) {
    if (timerBusy) return;
    timerBusy = true;
    const version = ++timerVersion;
    renderStudyTimer();
    timerError.textContent = '';
    try {
      const result = await send('STUDY_TIMER', { action, goalMinutes });
      if (version === timerVersion) { timerState = result.timer; timerGoal.dataset.loaded = ''; }
    } catch (error) { timerError.textContent = error.message; }
    finally { timerBusy = false; renderStudyTimer(); }
  }
  timerToggle.addEventListener('click', () => {
    timerBox.hidden = !timerBox.hidden;
    timerToggle.setAttribute('aria-expanded', String(!timerBox.hidden));
    if (!timerBox.hidden) void timerAction('get');
  });
  timerGoal.addEventListener('change', () => {
    if (timerGoal.value === '' || !timerGoal.checkValidity()) { timerError.textContent = 'Enter 0–1440 minutes.'; return; }
    void timerAction('set', Number(timerGoal.value));
  });
  timerStart.addEventListener('click', () => {
    if (!timerState) return;
    const finished = timerState.goalMinutes && timerState.elapsedMs + (timerState.startedAt === null ? 0 : Math.max(0, Date.now() - timerState.startedAt)) >= timerState.goalMinutes * 60000;
    void timerAction(timerState.startedAt !== null && !finished ? 'pause' : 'start');
  });
  timerReset.addEventListener('click', () => void timerAction('reset'));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.ogeStudyTimer) {
      ++timerVersion;
      timerState = changes.ogeStudyTimer.newValue || null;
      timerGoal.dataset.loaded = '';
      renderStudyTimer();
    }
  });
  void timerAction('get');
  function setPanel(tool) {
    active = tool;
    for (const body of panel.querySelectorAll('[data-panel]')) body.hidden = body.dataset.panel !== tool;
    for (const button of panel.querySelectorAll('[data-tool]')) {
      button.classList.toggle('selected', button.dataset.tool === tool);
    }
    setStatus('');
    if (tool === 'note') { note.focus(); void loadSubjects(); void syncLessonDestination(); }
    if (tool === 'links') void loadLinks();
    if (tool === 'tracks') void loadTracks();
  }
  // The fixed panel overlays the launcher footprint; no reserved 54px gap.
  const GAP = 8;
  const MIN_PANEL_WIDTH = 265;
  const MIN_PANEL_HEIGHT = 235;
  const clamp = (n, low, high) => Math.min(Math.max(n, low), Math.max(low, high));
  const CORNERS = ['top-right', 'bottom-right', 'bottom-left', 'top-left'];
  let snappedCorner = null;
  let nextCornerIndex = 0;
  const cornerButton = panel.querySelector('.corner-button');
  function updateCornerButton() {
    const next = CORNERS[nextCornerIndex];
    cornerButton.setAttribute('aria-label', 'Move widget to ' + next + ' corner');
    cornerButton.title = 'Move to ' + next + ' corner';
  }
  function placeSnappedCorner() {
    if (!snappedCorner || panel.classList.contains('hidden')) return;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const left = snappedCorner.endsWith('right') ? window.innerWidth - width - GAP : GAP;
    const top = snappedCorner.startsWith('bottom') ? window.innerHeight - height - GAP : GAP;
    panel.style.left = clamp(left, GAP, window.innerWidth - width - GAP) + 'px';
    panel.style.top = clamp(top, GAP, window.innerHeight - height - GAP) + 'px';
    // Keep the invisible launcher in the same footprint. Closing the panel
    // restores the O at this corner instead of leaving it elsewhere.
    const launcherLeft = snappedCorner.endsWith('right') ? left + width - launcher.offsetWidth : left;
    const launcherTop = top + height - launcher.offsetHeight;
    host.style.left = clamp(launcherLeft, GAP, window.innerWidth - launcher.offsetWidth - GAP) + 'px';
    host.style.top = clamp(launcherTop, GAP, window.innerHeight - launcher.offsetHeight - GAP) + 'px';
    host.style.right = 'auto';
    host.style.bottom = 'auto';
  }
  cornerButton.addEventListener('click', () => {
    snappedCorner = CORNERS[nextCornerIndex];
    nextCornerIndex = (nextCornerIndex + 1) % CORNERS.length;
    placeSnappedCorner();
    updateCornerButton();
    wake();
  });
  function positionPanel() {
    if (panel.classList.contains('hidden')) return;
    if (snappedCorner) { placeSnappedCorner(); return; }
    const launcherBounds = launcher.getBoundingClientRect();
    const maxWidth = Math.max(MIN_PANEL_WIDTH, window.innerWidth - GAP * 2);
    const maxHeight = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - GAP * 2);
    const width = Math.min(panel.offsetWidth, maxWidth);
    const height = Math.min(panel.offsetHeight, maxHeight);
    // Overlay the launcher instead of reserving a full button-height gap.
    // The panel and hidden O share the same bottom edge, allowing the panel
    // to reach the bottom of the viewport when dragged there.
    const x = clamp(launcherBounds.right - width, GAP, window.innerWidth - width - GAP);
    const y = clamp(launcherBounds.bottom - height, GAP, window.innerHeight - height - GAP);
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
  }
  let idleTimer;
  const IDLE_DELAY_MS = 12000;
  let composingInWidget = false;
  function wake() {
    host.style.opacity = '1';
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      // A live IME composition is still editing, even between keystrokes.
      if (composingInWidget && !panel.classList.contains('hidden')) { wake(); return; }
      // Stay discoverable while idle; never hide the editing surface entirely.
      host.style.opacity = panel.classList.contains('hidden') ? '.38' : '.78';
    }, IDLE_DELAY_MS);
  }
  for (const name of ['pointermove', 'keydown', 'wheel', 'touchstart']) {
    window.addEventListener(name, wake, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { composingInWidget = false; clearTimeout(idleTimer); host.style.opacity = '.38'; }
    else wake();
  });
  shadow.addEventListener('pointerdown', wake);
  shadow.addEventListener('focusin', wake);
  // Input also covers paste, dictation, autofill and IME composition, even
  // when keyboard shortcuts are intercepted at the window capture phase.
  for (const name of ['input', 'change', 'compositionstart', 'compositionupdate', 'compositionend', 'paste']) {
    shadow.addEventListener(name, wake, { capture: true, passive: true });
  }
  shadow.addEventListener('compositionstart', () => { composingInWidget = true; wake(); });
  shadow.addEventListener('compositionend', () => { composingInWidget = false; wake(); });
  shadow.addEventListener('focusout', () => { composingInWidget = false; wake(); });
  function openPanel(open) {
    if (!open) composingInWidget = false;
    panel.classList.toggle('hidden', !open);
    // Keep the launcher as a positioning anchor while the open panel hides it.
    // Closing restores the draggable O button.
    launcher.classList.toggle('is-panel-open', open);
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-hidden', String(open));
    launcher.tabIndex = open ? -1 : 0;
    wake();
    if (open) {
      positionPanel();
      void loadTracks();
      if (active === 'note') { note.focus(); void loadSubjects(); void syncLessonDestination(); }
    }
  }
  let launcherDrag = null;
  let ignoreLauncherClick = false;
  function placeLauncher(x, y) {
    snappedCorner = null;
    host.style.left = clamp(x, GAP, window.innerWidth - launcher.offsetWidth - GAP) + 'px';
    host.style.top = clamp(y, GAP, window.innerHeight - launcher.offsetHeight - GAP) + 'px';
    host.style.right = 'auto';
    host.style.bottom = 'auto';
    positionPanel();
  }
  launcher.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const rect = launcher.getBoundingClientRect();
    launcherDrag = { id: event.pointerId, startX: event.clientX, startY: event.clientY,
      left: rect.left, top: rect.top, moved: false };
    launcher.setPointerCapture(event.pointerId);
    wake();
  });
  launcher.addEventListener('pointermove', (event) => {
    if (!launcherDrag || launcherDrag.id !== event.pointerId) return;
    const dx = event.clientX - launcherDrag.startX;
    const dy = event.clientY - launcherDrag.startY;
    if (!launcherDrag.moved && Math.hypot(dx, dy) < 5) return;
    launcherDrag.moved = true;
    placeLauncher(launcherDrag.left + dx, launcherDrag.top + dy);
  });
  function finishLauncherDrag(event) {
    if (!launcherDrag || launcherDrag.id !== event.pointerId) return;
    if (launcherDrag.moved) ignoreLauncherClick = true;
    launcherDrag = null;
  }
  launcher.addEventListener('pointerup', finishLauncherDrag);
  launcher.addEventListener('pointercancel', finishLauncherDrag);
  launcher.addEventListener('click', (event) => {
    if (ignoreLauncherClick) {
      ignoreLauncherClick = false;
      event.preventDefault();
      return;
    }
    openPanel(panel.classList.contains('hidden'));
  });
  panel.querySelector('.close').addEventListener('click', () => openPanel(false));
  panel.querySelectorAll('[data-tool]').forEach((button) => {
    button.addEventListener('click', () => setPanel(button.dataset.tool));
  });
  // Keep website keyboard shortcuts away from focused widget form controls.
  // Do not preventDefault: native typing, selection and Tab navigation remain available.
  const stopPageShortcutsWhileTyping = (event) => {
    const focused = shadow.activeElement;
    if (panel.classList.contains('hidden') || !focused?.matches('textarea, input, select, button, [contenteditable="true"]')) return;
    wake();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  for (const name of ['keydown', 'keyup', 'keypress']) {
    window.addEventListener(name, stopPageShortcutsWhileTyping, true);
  }
  // Header movement remains available when expanded; dragging the launcher
  // itself now works without opening the panel first.
  const handle = panel.querySelector('.top');
  let headerDrag = null;
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const rect = launcher.getBoundingClientRect();
    headerDrag = { id: event.pointerId, x: event.clientX, y: event.clientY,
      left: rect.left, top: rect.top };
    handle.setPointerCapture(event.pointerId);
    wake();
  });
  handle.addEventListener('pointermove', (event) => {
    if (!headerDrag || headerDrag.id !== event.pointerId) return;
    placeLauncher(headerDrag.left + event.clientX - headerDrag.x,
      headerDrag.top + event.clientY - headerDrag.y);
  });
  handle.addEventListener('pointerup', () => { headerDrag = null; });
  handle.addEventListener('pointercancel', () => { headerDrag = null; });

  const resizeHandles = panel.querySelectorAll('.resize-corner');
  let resizeDrag = null;
  for (const resizeHandle of resizeHandles) {
  resizeHandle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    resizeDrag = { id: event.pointerId, x: event.clientX, y: event.clientY,
      width: rect.width, height: rect.height, left: rect.left, top: rect.top,
      fromLeft: resizeHandle.classList.contains('resize-corner-left') };
    resizeHandle.setPointerCapture(event.pointerId);
    wake();
  });
  resizeHandle.addEventListener('pointermove', (event) => {
    if (!resizeDrag || resizeDrag.id !== event.pointerId) return;
    const dx = event.clientX - resizeDrag.x;
    const width = resizeDrag.fromLeft
      ? clamp(resizeDrag.width - dx, MIN_PANEL_WIDTH, resizeDrag.left + resizeDrag.width - GAP)
      : clamp(resizeDrag.width + dx, MIN_PANEL_WIDTH, window.innerWidth - resizeDrag.left - GAP);
    const height = clamp(resizeDrag.height + event.clientY - resizeDrag.y,
      MIN_PANEL_HEIGHT, window.innerHeight - resizeDrag.top - GAP);
    panel.style.width = width + 'px';
    if (resizeDrag.fromLeft) panel.style.left = resizeDrag.left + resizeDrag.width - width + 'px';
    panel.style.height = height + 'px';
    if (snappedCorner) placeSnappedCorner();
    wake();
  });
  resizeHandle.addEventListener('pointerup', () => { resizeDrag = null; });
  resizeHandle.addEventListener('pointercancel', () => { resizeDrag = null; });
  }
  window.addEventListener('resize', () => {
    const width = Math.min(panel.offsetWidth, window.innerWidth - GAP * 2);
    const height = Math.min(panel.offsetHeight, window.innerHeight - GAP * 2);
    panel.style.width = Math.max(0, width) + 'px';
    panel.style.height = Math.max(0, height) + 'px';
    if (host.style.left) {
      const rect = launcher.getBoundingClientRect();
      placeLauncher(rect.left, rect.top);
    } else positionPanel();
  });
  wake();

  const noteSave = panel.querySelector('[data-save-note]');
  const noteNewCapture = panel.querySelector('[data-new-vault-note]');
  const noteOpenSaved = panel.querySelector('[data-open-saved-vault-note]');
  let lastSavedVaultNoteId = null;
  noteOpenSaved.addEventListener('click', async () => {
    if (!lastSavedVaultNoteId) return;
    try {
      await send('OPEN_VAULT_NOTE', { id: lastSavedVaultNoteId });
      setStatus('Opened your saved Note in Oge.');
    } catch (error) {
      setStatus(error.message || 'Could not open the saved Note.', true);
    }
  });
  // Unknown destination is NOT permission to fall back to MongoDB.
  // Wait for the owner's subject list to select the right writer.
  let vaultReady = null;
  let pendingVaultCapture = null;
  // If text changes during a confirmed Save, the next click updates that
  // same GitHub Note instead of creating an accidental duplicate.
  let pendingSavedUpdate = null;
  let savingCapture = false;
  // crypto.randomUUID() is absent in some HTTP page contexts where the
  // extension can still run. getRandomValues() is available there.
  function createCaptureId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' +
      hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }
  noteSave.disabled = true;
  async function loadSubjects() {
    const previous = subjectSelect.value;
    try {
      const result = await send('GET_SUBJECTS');
      vaultReady = result.vaultReady === true;
      subjectSelect.replaceChildren();
      const quick = document.createElement('option');
      quick.value = '';
      quick.textContent = 'Quick Notes (default)';
      subjectSelect.append(quick);
      for (const subject of result.subjects || []) {
        if (typeof subject.slug !== 'string' || typeof subject.name !== 'string') continue;
        const option = document.createElement('option');
        option.value = subject.slug;
        option.textContent = subject.name;
        subjectSelect.append(option);
      }
      if (previous && [...subjectSelect.options].some((option) => option.value === previous)) {
        subjectSelect.value = previous;
      } else {
        // Quick Notes is always the default destination. Subjects are
        // optional and select the regular Notes library instead.
        subjectSelect.value = '';
      }
      noteSave.disabled = savingCapture;
      void loadNotes();
      updateNoteButton();
    } catch (error) {
      // Do not guess the storage destination after an API/network failure.
      vaultReady = null;
      noteSave.disabled = true;
      setStatus(error.message || 'Could not load subjects. Reopen this panel to retry.', true);
    }
  }
  let notePickerRequest = 0;
  let listedNotes = new Map();
  let pickerBusy = false;
  async function loadNotes(reset = true) {
    const subject = subjectSelect.value;
    const request = ++notePickerRequest;
    notePicker.hidden = !subject;
    if (!subject) {
      noteSelect.replaceChildren(new Option('Default (new Note)', ''));
      listedNotes = new Map();
      noteMore.hidden = true;
      return;
    }
    if (reset) {
      noteSelect.replaceChildren(new Option('Default (new Note)', ''));
      listedNotes = new Map();
    }
    pickerBusy = true;
    noteSelect.disabled = true;
    noteMore.hidden = true;
    try {
      const offset = listedNotes.size;
      const result = await send('GET_NOTES_FOR_SUBJECT', { subjectSlug: subject, offset });
      if (request !== notePickerRequest || subjectSelect.value !== subject) return;
      for (const item of result.notes || []) {
        if (typeof item.id !== 'string' || typeof item.heading !== 'string' ||
            typeof item.version !== 'string') continue;
        listedNotes.set(item.id, item);
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.heading;
        noteSelect.append(option);
      }
      noteMore.hidden = result.hasMore !== true;
    } catch (error) {
      if (request === notePickerRequest) setStatus(error.message || 'Could not load recent Notes.', true);
    } finally {
      if (request === notePickerRequest) {
        pickerBusy = false;
        noteSelect.disabled = false;
        updateNoteButton();
      }
    }
  }
  noteSelect.addEventListener('change', () => {
    chooseManualDestination();
    pendingSavedUpdate = null;
    pendingVaultCapture = null;
    updateNoteButton();
  });
  noteMore.addEventListener('click', () => { if (!pickerBusy) void loadNotes(false); });
  let lessonDestination = null;
  let lessonLookupVersion = 0;
  let lessonLookupBusy = false;
  let lessonLookupFailed = false;
  let manualLessonDestination = false;
  let lessonPageKey = '';
  let draftLessonKey = '';
  const lessonContext = panel.querySelector('[data-lesson-context]');
  const timestampControl = panel.querySelector('[data-lesson-timestamp]');
  const timestampToggle = panel.querySelector('[data-attach-timestamp]');
  let pendingLessonTimestamp = null;
  function capturePlaybackSeconds() {
    const player = document.querySelector('#movie_player video.html5-main-video');
    if (!player || !Number.isFinite(player.currentTime) || player.currentTime < 0 || player.currentTime > 864000 || !Number.isFinite(player.duration) || document.querySelector('#movie_player.ad-showing')) return null;
    return Math.floor(player.currentTime);
  }
  const manualDestination = panel.querySelector('[data-manual-destination]');
  const autoDestination = panel.querySelector('[data-auto-destination]');
  function currentLessonKey() {
    const url = new URL(location.href);
    if (!['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(url.hostname) || url.pathname !== '/watch') return '';
    const video = url.searchParams.get('v') || '';
    const playlist = url.searchParams.get('list') || '';
    return /^[A-Za-z0-9_-]{11}$/.test(video) && /^[A-Za-z0-9_-]{10,120}$/.test(playlist) ? playlist + ':' + video : '';
  }
  function chooseManualDestination() {
    ++lessonLookupVersion;
    lessonLookupBusy = false;
    lessonLookupFailed = false;
    lessonDestination = null;
    manualLessonDestination = true;
    draftLessonKey = '';
    updateNoteButton();
  }
  async function syncLessonDestination() {
    const key = currentLessonKey();
    if (lessonPageKey !== key) {
      lessonPageKey = key;
      manualLessonDestination = false;
      lessonDestination = null;
    }
    if (manualLessonDestination || savingCapture) return;
    const version = ++lessonLookupVersion;
    lessonLookupFailed = false;
    lessonDestination = null;
    if (!key) { lessonLookupBusy = false; lessonLookupFailed = Boolean(note.value.trim() && draftLessonKey); updateNoteButton(); return; }
    if (note.value.trim() && draftLessonKey && draftLessonKey !== key) {
      lessonLookupBusy = false;
      lessonLookupFailed = true;
      updateNoteButton();
      return;
    }
    lessonLookupBusy = true;
    updateNoteButton();
    try {
      const result = await send('LIST_LEARNING_TRACKS');
      if (version !== lessonLookupVersion || currentLessonKey() !== key) return;
      const track = (result.tracks || []).find(item => item.playlistId === key.split(':')[0] && item.subjectSlug);
      if (!track) return;
      const destination = await send('LOOKUP_LESSON_NOTE', { id: track.id });
      if (version !== lessonLookupVersion || currentLessonKey() !== key) return;
      lessonDestination = { ...destination, trackId: track.id };
      if (note.value.trim() && !draftLessonKey) draftLessonKey = key;
    } catch {
      if (version === lessonLookupVersion) lessonLookupFailed = true;
    } finally {
      if (version === lessonLookupVersion) {
        lessonLookupBusy = false;
        updateNoteButton();
      }
    }
  }
  manualDestination.addEventListener('click', chooseManualDestination);
  autoDestination.addEventListener('click', () => {
    if (note.value.trim() && draftLessonKey && draftLessonKey !== currentLessonKey()) {
      if (!window.confirm('Use this unsaved text for the currently playing lesson?')) return;
    }
    draftLessonKey = currentLessonKey();
    manualLessonDestination = false;
    void syncLessonDestination();
  });
  note.addEventListener('input', () => {
    if (!note.value.trim()) draftLessonKey = '';
    else if (!draftLessonKey && !manualLessonDestination) draftLessonKey = currentLessonKey();
  });
  function onLessonNavigation() {
    if (currentLessonKey() !== lessonPageKey) void syncLessonDestination();
  }
  document.addEventListener('yt-navigate-finish', onLessonNavigation);
  window.addEventListener('popstate', onLessonNavigation);
  function updateNoteButton() {
    const contextual = Boolean(lessonDestination || lessonLookupBusy || lessonLookupFailed);
    lessonContext.hidden = !contextual;
    timestampControl.hidden = !lessonDestination;
    timestampControl.style.display = lessonDestination ? '' : 'none';
    timestampToggle.disabled = savingCapture || lessonLookupBusy;
    manualDestination.hidden = !contextual;
    autoDestination.hidden = !manualLessonDestination && !lessonLookupFailed;
    subjectSelect.disabled = contextual;
    noteSelect.disabled = contextual || pickerBusy;
    noteSave.disabled = savingCapture || lessonLookupBusy || lessonLookupFailed || (!lessonDestination && vaultReady === null);
    if (lessonLookupBusy || lessonLookupFailed) {
      lessonContext.textContent = lessonLookupBusy ? 'Finding current lesson Note…' : 'Lesson destination unavailable or unsaved text belongs to a previous video. Choose a destination explicitly.';
      noteSave.textContent = 'Choose Note destination';
      return;
    }
    if (lessonDestination) lessonContext.textContent = 'Current lesson Note · ' + lessonDestination.subject + ' / ' + lessonDestination.title;
    if (lessonDestination) {
      noteSave.textContent = (lessonDestination.existing ? 'Append to ' : 'Save to ') + lessonDestination.title;
      return;
    }
    const selected = listedNotes.get(noteSelect.value);
    const continuing = !selected && vaultReady === true && pendingSavedUpdate &&
      pendingSavedUpdate.subjectSlug === subjectSelect.value;
    noteNewCapture.hidden = !continuing;
    noteSave.textContent = vaultReady === null ? 'Loading destination…'
      : selected ? 'Append to ' + selected.heading + ' →'
      : vaultReady ? (subjectSelect.value
        ? continuing ? 'Update saved Note →' : 'Save to selected subject →'
        : 'Save to Quick Notes')
        : subjectSelect.value ? 'Save to selected subject →' : 'Save to Quick Notes';
  }
  subjectSelect.addEventListener('change', () => {
    chooseManualDestination();
    pendingSavedUpdate = null;
    pendingVaultCapture = null;
    void loadNotes();
    updateNoteButton();
  });

  noteSave.addEventListener('click', async () => {
    if (savingCapture || lessonLookupBusy || lessonLookupFailed) return;
    if (!note.value.trim()) return setStatus('Write something before saving.', true);
    if (lessonDestination) {
      const target = lessonDestination;
      const submitted = note.value;
      const retryKey = JSON.stringify([target.trackId, target.videoId, target.version, submitted, timestampToggle.checked]);
      if (pendingLessonTimestamp?.key !== retryKey) pendingLessonTimestamp = { key: retryKey, seconds: timestampToggle.checked ? capturePlaybackSeconds() : null };
      const playbackSeconds = pendingLessonTimestamp.seconds;
      const timestampUnavailable = timestampToggle.checked && playbackSeconds === null;
      savingCapture = true; noteSave.disabled = true;
      try {
        const result = await send('CREATE_LESSON_NOTE', { id: target.trackId, content: submitted, expectedTopicKey: target.topicKey, expectedSubjectSlug: target.subjectSlug, expectedVideoId: target.videoId, expectedNoteId: target.id, expectedVersion: target.version, playbackSeconds });
        if (result.confirmed !== true) throw new Error('Lesson Note Save was not confirmed.');
        if (note.value === submitted) note.value = '';
        if (lessonDestination === target) lessonDestination = { ...target, existing: true, id: result.id, title: result.title, version: result.version || result.sha };
        if (!note.value.trim()) draftLessonKey = '';
        pendingLessonTimestamp = null;
        setStatus('Saved lesson Note “' + result.title + '”.' + (timestampUnavailable ? ' Playback time unavailable; video source saved.' : ''));
        void loadNotes();
      } catch (error) { setStatus(error.message + ' Your text remains in the editor. Reopen Lesson Note before retrying.', true); }
      finally { savingCapture = false; updateNoteButton(); if (currentLessonKey() !== lessonPageKey) void syncLessonDestination(); }
      return;
    }
    if (vaultReady === null) return setStatus('Load your Oge Notes connection before saving.', true);
    // Snapshot exactly what this request intends to commit. The user can
    // keep typing while the network is slow; that newer text is NOT part
    // of this Save and must never be erased by its eventual response.
    const submittedContent = note.value;
    const submittedSubject = subjectSelect.value;
    const submittedToVault = vaultReady;
    const selectedNote = listedNotes.get(noteSelect.value) || null;
    const submittedNoteId = noteSelect.value;
    if (submittedSubject && submittedNoteId && !selectedNote)
      return setStatus('Refresh the Note selector before appending.', true);
    savingCapture = true;
    noteSave.disabled = true;
    setStatus(submittedToVault ? 'Saving to GitHub Vault…' : 'Saving note…');
    try {
      let result;
      if (selectedNote) {
        result = await send('APPEND_TO_NOTE', {
          subjectSlug: submittedSubject, noteId: selectedNote.id,
          version: selectedNote.version, content: submittedContent,
        });
        if (result.confirmed !== true || result.id !== selectedNote.id)
          throw new Error('Append was not confirmed. Refresh before retrying.');
        pendingSavedUpdate = null;
        pendingVaultCapture = null;
        if (submittedToVault) {
          lastSavedVaultNoteId = result.id;
          noteOpenSaved.hidden = false;
        }
        if (note.value === submittedContent && subjectSelect.value === submittedSubject &&
            noteSelect.value === submittedNoteId) note.value = '';
        else {
          // Never automatically retry stale content after a successful append.
          noteSelect.value = '';
        }
        setStatus('Appended to “' + result.title + '”.' +
          (note.value ? ' Newer edits remain here; select the Note again after reviewing them.' : ''));
        void loadNotes();
        return;
      }
      if (submittedToVault) {
        if (!submittedSubject) {
          // The extension alone creates standalone Quick Notes.
          // Hold this UUID across a lost response to prevent duplicates.
          if (!pendingVaultCapture ||
              pendingVaultCapture.content !== submittedContent ||
              pendingVaultCapture.subjectSlug !== '') {
            pendingVaultCapture = {
              id: createCaptureId(), content: submittedContent, subjectSlug: '',
            };
          }
          result = await send('CREATE_VAULT_QUICK_NOTE', {
            content: submittedContent, captureId: pendingVaultCapture.id,
          });
          if (result.confirmed !== true ||
              result.destination !== 'quick-notes' ||
              !/^[a-f0-9]{40}$/i.test(result.sha || ''))
            throw new Error('Quick Note Save was not confirmed.');
          pendingVaultCapture = null;
          pendingSavedUpdate = null;
          lastSavedVaultNoteId = null;
          noteOpenSaved.hidden = true;
        } else {
        if (pendingSavedUpdate &&
            pendingSavedUpdate.subjectSlug === submittedSubject) {
          // The previous Save succeeded, but the user kept editing the
          // text. Update that Note using its exact GitHub blob revision.
          result = await send('UPDATE_VAULT_NOTE', {
            content: submittedContent, subjectSlug: submittedSubject,
            captureId: pendingSavedUpdate.id, sha: pendingSavedUpdate.sha,
          });
        } else {
          // If the response was lost, resubmitting the same unchanged
          // capture reuses its UUID rather than creating a duplicate.
          if (!pendingVaultCapture ||
              pendingVaultCapture.content !== submittedContent ||
              pendingVaultCapture.subjectSlug !== submittedSubject) {
            pendingVaultCapture = {
              id: createCaptureId(), content: submittedContent,
              subjectSlug: submittedSubject,
            };
          }
          result = await send('CREATE_VAULT_NOTE', {
            content: submittedContent, subjectSlug: submittedSubject,
            captureId: pendingVaultCapture.id,
          });
        }
        if (result.confirmed !== true || typeof result.id !== 'string' ||
            !/^[a-f0-9]{40}$/i.test(result.sha || ''))
          throw new Error('GitHub Save was not confirmed with a Note revision.');
        pendingVaultCapture = null;
        lastSavedVaultNoteId = result.id;
        noteOpenSaved.hidden = false;
        }
      } else {
        result = await send('CREATE_QUICK_NOTE', {
          content: submittedContent, subjectSlug: submittedSubject,
        });
      }
      const unchanged = note.value === submittedContent &&
        subjectSelect.value === submittedSubject && !noteSelect.value;
      if (submittedToVault && submittedSubject) {
        pendingSavedUpdate = unchanged ? null : {
          id: result.id, sha: result.sha, subjectSlug: submittedSubject,
        };
      }
      if (unchanged) note.value = '';
      const confirmation = result.destination === 'vault'
        ? 'Saved “' + result.title + '” to ' + result.subject + ' in Notes.'
        : result.destination === 'notes'
          ? 'Saved “' + result.title + '” to ' + result.subject + ' in Notes.'
          : 'Saved “' + result.title + '” to Quick Notes.';
      if (submittedSubject) void loadNotes();
      setStatus(confirmation + (unchanged ? ''
        : submittedToVault && submittedSubject && subjectSelect.value === submittedSubject
          ? ' Newer edits are still here; press Save again to update the same Note.'
          : ' Newer edits are still in your editor; press Save again for them.'));
    } catch (error) {
      // Do not erase text or the retry UUID on an uncertain Save.
      setStatus((error.message || 'Save was not confirmed.') +
        ' Your note is still in the editor.', true);
    } finally {
      savingCapture = false;
      noteSave.disabled = vaultReady === null;
      updateNoteButton();
    }
  });
  // M114: The user may want to turn the remaining text into a different
  // note, not append it to the Note saved while they were still typing.
  // Keep their text intact; the next Save will create a new UUID.
  noteNewCapture.addEventListener('click', () => {
    if (savingCapture || !pendingSavedUpdate) return;
    pendingSavedUpdate = null;
    pendingVaultCapture = null;
    updateNoteButton();
    setStatus('Ready to save this text as a separate Note. Your earlier GitHub Note is unchanged.');
  });
  const urlSave = panel.querySelector('[data-save-url]');
  urlSave.addEventListener('click', async () => {
    urlSave.disabled = true;
    setStatus('Saving website…');
    try {
      const result = await send('SAVE_CURRENT_TAB');
      setStatus('Page link saved to Saved Links: “' + result.title + '”.');
    } catch (error) { setStatus(error.message, true); }
    finally { urlSave.disabled = false; }
  });
  let trackLoadVersion = 0;
  async function loadTracks() {
    const container = panel.querySelector('[data-track-list]');
    const tab = panel.querySelector('[data-tool="tracks"]');
    if (!container || !tab) return;
    const version = ++trackLoadVersion;
    try {
      const result = await send('LIST_LEARNING_TRACKS');
      if (version !== trackLoadVersion) return;
      tab.hidden = false;
      panel.querySelector('.belt').classList.add('tracks-enabled');
      container.replaceChildren();
      const tracks = Array.isArray(result.tracks) ? result.tracks : [];
      const subjectPicker = panel.querySelector('[data-track-subject]');
      let subjects = [];
      try { const response = await send('GET_SUBJECTS'); subjects = Array.isArray(response.subjects) ? response.subjects : []; } catch { /* unassigned remains usable */ }
      if (version !== trackLoadVersion) return;
      const previous = subjectPicker.value;
      subjectPicker.replaceChildren(new Option('Unassigned', ''));
      for (const subject of subjects) subjectPicker.add(new Option(subject.name, subject.slug));
      if (subjects.some(subject => subject.slug === previous)) subjectPicker.value = previous;
      if (!tracks.length) {
        const empty = document.createElement('p');
        empty.className = 'track-empty';
        empty.textContent = 'No learning tracks yet. Create your first track below.';
        container.append(empty);
      }
      for (const track of tracks) {
        const row = document.createElement('div');
        row.className = 'track-card';
        const source = new URL(location.href);
        const current = source.pathname === '/watch' && source.searchParams.get('list') === track.playlistId;
        if (current) {
          row.classList.add('is-current');
          const label = document.createElement('span');
          label.className = 'track-current-label';
          label.textContent = 'Current playlist';
          row.append(label);
        }
        const title = document.createElement('strong');
        title.className = 'track-card-title';
        title.textContent = track.title;
        const subjectLabel = document.createElement('span');
        subjectLabel.className = 'track-subject';
        subjectLabel.textContent = 'Subject: ' + (subjects.find(subject => subject.slug === track.subjectSlug)?.name || 'Unassigned');
        const progressBox = document.createElement('div');
        progressBox.className = 'track-progress';
        const progress = document.createElement('span');
        progress.className = 'track-progress-text';
        progressBox.append(progress);
        progress.textContent = track.completedVideos + (track.totalVideos == null ? '' : ' / ' + track.totalVideos) + ' completed · ' + track.videosPerDay + ' videos/day';
        const actions = document.createElement('div');
        actions.className = 'track-actions';
        const watch = document.createElement('button');
        watch.type = 'button';
        watch.textContent = 'Watch next';
        watch.addEventListener('click', async () => {
          watch.disabled = true;
          setStatus('Finding next lesson…');
          try {
            const result = await send('WATCH_NEXT_LESSON', { id: track.id });
            if (version === trackLoadVersion && active === 'tracks') {
              if (Number.isInteger(result.totalVideos))
                progress.textContent = track.completedVideos + ' / ' + result.totalVideos + ' completed · ' + track.videosPerDay + ' videos/day';
              setStatus((result.finished ? 'All current playlist lessons are complete.' : result.noLater ? 'No later unfinished lesson. Open Learning Tracks to review earlier lessons.' : 'Opened: ' + result.title) + (result.stale ? ' (Cached playlist; refresh unavailable.)' : ''));
            }
          } catch (error) {
            if (version === trackLoadVersion && active === 'tracks') setStatus(error.message, true);
          } finally { watch.disabled = false; }
        });
        const refresh = document.createElement('button');
        refresh.type = 'button';
        refresh.textContent = 'Refresh playlist';
        refresh.addEventListener('click', async () => {
          refresh.disabled = true;
          setStatus('Refreshing playlist…');
          try {
            const result = await send('REFRESH_TRACK_PLAYLIST', { id: track.id });
            if (version !== trackLoadVersion || active !== 'tracks') return;
            progress.textContent = result.completedVideos + (result.totalVideos == null ? '' : ' / ' + result.totalVideos) + ' completed · ' + track.videosPerDay + ' videos/day';
            setStatus(result.stale ? 'Refresh unavailable. Using previously retrieved playlist metadata.' : 'Playlist refreshed.');
          } catch (error) {
            if (version === trackLoadVersion && active === 'tracks') setStatus(error.message, true);
          } finally { refresh.disabled = false; }
        });
        actions.append(watch, refresh);
        if (current) {
          const complete = document.createElement('button');
          const undo = document.createElement('button');
          complete.type = undo.type = 'button';
          complete.className = 'track-complete';
          complete.textContent = 'Complete & Next';
          undo.textContent = 'Undo current';
          const update = async (isUndo) => {
            complete.disabled = undo.disabled = watch.disabled = refresh.disabled = true;
            setStatus('Saving lesson progress…');
            try {
              const result = await send(isUndo ? 'UNDO_CURRENT_LESSON' : 'COMPLETE_NEXT_LESSON', { id: track.id });
              if (version !== trackLoadVersion || active !== 'tracks') return;
              progress.textContent = result.completedVideos + ' / ' + result.totalVideos + ' completed · ' + track.videosPerDay + ' videos/day';
              setStatus((isUndo ? 'Current lesson marked unfinished.' : result.navigationFailed ? 'Progress saved; could not open next lesson.' : result.next ? 'Progress saved. Opening next lesson…' : result.hasUnfinished ? 'Progress saved. Earlier lessons remain.' : 'All current lessons complete.') + (result.stale ? ' (Cached playlist; refresh unavailable.)' : ''));
            } catch (error) {
              if (version === trackLoadVersion && active === 'tracks') setStatus(error.message, true);
            } finally { complete.disabled = undo.disabled = watch.disabled = refresh.disabled = false; }
          };
          complete.addEventListener('click', () => void update(false));
          undo.addEventListener('click', () => void update(true));
          actions.append(complete, undo);
          if (track.subjectSlug) {
            const capture = document.createElement('button');
            capture.type = 'button';
            capture.className = 'track-note';
            capture.textContent = 'Lesson Note';
            capture.addEventListener('click', async () => {
              if (savingCapture) return;
              capture.disabled = true;
              try {
                const destination = await send('LOOKUP_LESSON_NOTE', { id: track.id });
                if (version !== trackLoadVersion || active !== 'tracks') return;
                ++lessonLookupVersion;
                lessonLookupBusy = false;
                lessonLookupFailed = false;
                manualLessonDestination = false;
                lessonPageKey = currentLessonKey();
                if (note.value.trim() && draftLessonKey && draftLessonKey !== lessonPageKey && !window.confirm('Use this unsaved text for the current lesson?')) return;
                draftLessonKey = note.value.trim() ? lessonPageKey : '';
                lessonDestination = { ...destination, trackId: track.id };
                setPanel('note');
                updateNoteButton();
                setStatus((destination.existing ? 'Append to ' : 'Save to ') + destination.title + ' · ' + destination.subject);
              } catch (error) { setStatus(error.message, true); }
              finally { capture.disabled = false; }
            });
            actions.append(capture);
          }
        }
        row.append(title, subjectLabel, progressBox, actions);
        container.append(row);
      }
    } catch {
      if (version !== trackLoadVersion) return;
      container.replaceChildren();
      tab.hidden = true;
      panel.querySelector('.belt').classList.remove('tracks-enabled');
      if (active === 'tracks') setPanel('note');
    }
  }
  if (LEARNING_TRACKS_EXTENSION_PREVIEW) {
    panel.querySelector('[data-refresh-tracks]').addEventListener('click', () => void loadTracks());
    panel.querySelector('[data-open-learning-tracks]').addEventListener('click', async () => {
      try { await send('OPEN_LEARNING_TRACKS'); setStatus('Opened Learning Tracks in Oge.'); }
      catch (error) { setStatus(error.message || 'Could not open Learning Tracks.'); }
    });
    const trackSave = panel.querySelector('[data-save-track]');
    trackSave.addEventListener('click', async () => {
      const title = panel.querySelector('[data-track-title]').value.trim();
      const dailyRaw = panel.querySelector('[data-track-daily]').value;
      if (!title || !dailyRaw) {
        return setStatus('Enter a title and valid video counts.', true);
      }
      trackSave.disabled = true;
      setStatus('Detecting playlist videos…');
      try {
        const result = await send('CREATE_LEARNING_TRACK', {
          title, videosPerDay: Number(dailyRaw), subjectSlug: panel.querySelector('[data-track-subject]').value,
        });
        void loadTracks();
        setStatus('Created “' + result.title + '” with ' + result.totalVideos + ' videos.');
      } catch (error) { setStatus(error.message || 'Could not create learning track.', true); }
      finally { trackSave.disabled = false; }
    });
  }
  async function copyUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for pages where the Clipboard API is not available to
      // content scripts. Never use page-supplied code or clipboard HTML.
      const input = document.createElement('textarea');
      input.value = url;
      input.style.cssText = 'position:fixed;left:-9999px;top:0';
      shadow.append(input);
      input.focus();
      input.select();
      const succeeded = document.execCommand('copy');
      input.remove();
      if (!succeeded) throw new Error('Copy failed. Open the extension popup to copy this link.');
    }
  }
  async function loadLinks() {
    const container = panel.querySelector('[data-links]');
    container.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'empty';
    loading.textContent = 'Loading profile links…';
    container.append(loading);
    try {
      const result = await send('GET_PROFILE_LINKS');
      container.replaceChildren();
      const kinds = { github: 'GitHub', linkedin: 'LinkedIn', portfolio: 'Portfolio' };
      let count = 0;
      for (const [kind, label] of Object.entries(kinds)) {
        const url = result.links?.[kind];
        if (typeof url !== 'string') continue;
        count += 1;
        const row = document.createElement('div');
        row.className = 'link';
        const title = document.createElement('strong');
        title.textContent = label;
        const address = document.createElement('span');
        address.className = 'address';
        address.textContent = url;
        address.title = url;
        const actions = document.createElement('div');
        actions.className = 'link-actions';
        const copy = document.createElement('button');
        copy.textContent = 'Copy';
        copy.type = 'button';
        copy.setAttribute('aria-label', 'Copy ' + label + ' link');
        copy.addEventListener('click', async () => {
          try { await copyUrl(url); setStatus(label + ' copied.'); }
          catch (error) { setStatus(error.message, true); }
        });
        const visit = document.createElement('button');
        visit.textContent = 'Visit ↗';
        visit.type = 'button';
        visit.setAttribute('aria-label', 'Visit ' + label + ' link');
        visit.addEventListener('click', async () => {
          try { await send('VISIT_PROFILE_LINK', { kind }); }
          catch (error) { setStatus(error.message, true); }
        });
        actions.append(copy, visit);
        row.append(title, address, actions);
        container.append(row);
      }
      if (!count) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = 'No social links yet. Add GitHub, LinkedIn or your portfolio in OgeNotes Profile.';
        container.append(empty);
      }
    } catch (error) {
      container.replaceChildren();
      setStatus(error.message, true);
    }
  }
})();
