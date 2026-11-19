// Small Markdown-to-print layout adapter. This intentionally supports the
// common study-note constructs without a PDF rendering dependency.
export function cleanPdfInline(value) {
  return String(value || '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[Image: $1]')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

export function notePdfBlocks(answer) {
  const rows = String(answer || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let code = false;
  for (const line of rows) {
    const trimmed = line.trim();
    if (/^\s*```/.test(line)) {
      code = !code;
      blocks.push({ kind: 'space', text: '' });
      continue;
    }
    if (code) {
      blocks.push({ kind: 'code', text: line.replace(/\t/g, '    ') });
      continue;
    }
    if (!trimmed) { blocks.push({ kind: 'space', text: '' }); continue; }
    if (/^([-*_]\s*){3,}$/.test(trimmed)) {
      blocks.push({ kind: 'divider', text: '' }); continue;
    }
    const heading = /^\s*(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length,
        text: cleanPdfInline(heading[2]) }); continue;
    }
    const list = /^\s*([-*+]\s+|\d+[.)]\s+)(.+)$/.exec(line);
    if (list) {
      blocks.push({ kind: 'list', text:
        (/\d/.test(list[1]) ? list[1].trim() : '•') + ' ' + cleanPdfInline(list[2]) });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      blocks.push({ kind: 'quote', text: cleanPdfInline(trimmed.replace(/^>\s?/, '')) });
      continue;
    }
    if (/\|/.test(trimmed) && /^\s*\|?\s*:?-{3,}/.test(trimmed)) continue;
    if (trimmed.includes('|') && (trimmed.startsWith('|') || trimmed.endsWith('|'))) {
      const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|');
      blocks.push({ kind: 'table', text: cells.map((c) => cleanPdfInline(c.trim())).join('    |    ') });
      continue;
    }
    blocks.push({ kind: 'paragraph', text: cleanPdfInline(trimmed) });
  }
  return blocks;
}
