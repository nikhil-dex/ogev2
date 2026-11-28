// Portable Markdown references. Compare canonical video identities, not URL spelling.
export function sourceVideoIds(markdown) {
  const ids = new Set();
  for (const match of String(markdown || '').matchAll(/https:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/watch\?[^\s<>()]+|youtu\.be\/[A-Za-z0-9_-]{11}(?:\?[^\s<>()]*)?)/gi)) {
    try {
      const url = new URL(match[0].replace(/[.,;]+$/, '').replace(/&amp;/g, '&'));
      const id = url.hostname.endsWith('youtu.be') ? url.pathname.slice(1) : url.searchParams.get('v');
      if (/^[A-Za-z0-9_-]{11}$/.test(id || '')) ids.add(id);
    } catch { /* Ignore malformed URLs in ordinary Note text. */ }
  }
  return ids;
}
export function normalizePlaybackSeconds(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 864000 ? Math.floor(value) : null;
}
export function timestampLabel(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? h + ':' + String(m).padStart(2, '0') + ':' + s : m + ':' + s;
}
export function lessonSourceCapture(content, video, previous = '', playbackSeconds = null) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(video?.videoId || '') || typeof video.title !== 'string')
    throw new TypeError('Invalid source lesson.');
  const title = video.title.replace(/\s+/g, ' ').trim().slice(0, 180).replace(/[\\[\]<>]/g, '\\$&');
  const url = 'https://www.youtube.com/watch?v=' + video.videoId;
  const text = content.trim();
  const known = sourceVideoIds(previous);
  // Each capture identifies its lesson; only the first inserts the clickable URL.
  const seconds = normalizePlaybackSeconds(playbackSeconds);
  const timestampUrl = seconds === null ? null : url + '&t=' + seconds + 's';
  const timestamp = timestampUrl && !String(previous).includes(timestampUrl + ')')
    ? 'Timestamp: [' + timestampLabel(seconds) + '](' + timestampUrl + ')\n\n' : '';
  return '### From: ' + title + '\n\n' +
    (known.has(video.videoId) ? '' : 'Source: [' + title + '](' + url + ')\n\n') + timestamp + text;
}
