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
export function lessonSourceCapture(content, video, previous = '') {
  if (!/^[A-Za-z0-9_-]{11}$/.test(video?.videoId || '') || typeof video.title !== 'string')
    throw new TypeError('Invalid source lesson.');
  const title = video.title.replace(/\s+/g, ' ').trim().slice(0, 180).replace(/[\\[\]<>]/g, '\\$&');
  const url = 'https://www.youtube.com/watch?v=' + video.videoId;
  const text = content.trim();
  const known = sourceVideoIds(previous);
  // Each capture identifies its lesson; only the first inserts the clickable URL.
  return known.has(video.videoId)
    ? '### From: ' + title + '\n\n' + text
    : '### From: ' + title + '\n\nSource: [' + title + '](' + url + ')\n\n' + text;
}
