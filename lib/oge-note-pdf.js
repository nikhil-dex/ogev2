// Browser-local, Unicode-friendly PDF pages. No external conversion service.
import { notePdfBlocks } from './oge-note-pdf-layout.js';
function pdfBytes(text) { return new TextEncoder().encode(text); }

export async function notePdfFile(note, subjectName = 'Notes') {
  if (typeof document === 'undefined') throw new Error('PDF export requires a browser.');
  const canvas = document.createElement('canvas');
  canvas.width = 840;
  canvas.height = 1190;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser PDF rendering unavailable.');
  const pages = [];
  let y = 0;
  function newPage() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#243629';
    ctx.font = '22px sans-serif';
    y = 72;
  }
  async function finishPage() {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84));
    if (!blob) throw new Error('Could not render PDF page.');
    pages.push(new Uint8Array(await blob.arrayBuffer()));
  }
  newPage();
  const lines = [
    { kind: 'subject', text: subjectName },
    { kind: 'title', text: note.heading || 'Untitled Note' },
    { kind: 'space', text: '' },
    ...notePdfBlocks(note.answer),
  ];
  for (const line of lines) {
    if (pages.length >= 70) throw new Error('Note is too long for PDF export.');
    if (line.kind === 'space') { y += 12; continue; }
    if (line.kind === 'divider') {
      if (y > 1080) { await finishPage(); newPage(); }
      ctx.fillStyle = '#c5d6c9';
      ctx.fillRect(66, y, 705, 2);
      y += 17;
      continue;
    }
    const headingSize = [0, 28, 26, 23, 21, 19, 18][line.level || 0];
    const size = line.kind === 'title' ? 34 :
      line.kind === 'subject' ? 17 : line.kind === 'heading' ? headingSize :
        line.kind === 'code' ? 17 : line.kind === 'table' ? 17 : 20;
    const indent = ['code', 'list', 'quote'].includes(line.kind) ? 22 : 0;
    const color = line.kind === 'subject' ? '#6a756e' :
      line.kind === 'heading' ? '#2e6a4c' :
        line.kind === 'quote' ? '#586b60' : '#243629';
    const fontFamily = line.kind === 'code' ? 'monospace' : 'sans-serif';
    const weight = line.kind === 'heading' || line.kind === 'title' ? 'bold ' : '';
    const italic = line.kind === 'quote' ? 'italic ' : '';
    ctx.font = italic + weight + size + 'px ' + fontFamily;
    const wrap = [];
    let running = '';
    const usableWidth = 706 - indent;
    for (const word of (line.text || '').split(/(\s+)/)) {
      if (ctx.measureText(running + word).width <= usableWidth) {
        running += word;
        continue;
      }
      if (running) { wrap.push(running); running = ''; }
      for (const ch of word) {
        if (ctx.measureText(running + ch).width > usableWidth && running) {
          wrap.push(running); running = '';
        }
        running += ch;
      }
    }
    wrap.push(running);
    const lineHeight = size + 10;
    const gap = ['title', 'heading'].includes(line.kind) ? 10 : 5;
    if (y + lineHeight + gap > 1090) { await finishPage(); newPage(); }
    for (const segment of wrap) {
      if (y + lineHeight > 1090) { await finishPage(); newPage(); }
      // Code and quotes visibly differ from normal prose.
      if (['code', 'quote', 'table'].includes(line.kind)) {
        ctx.fillStyle = line.kind === 'code' ? '#f0f4f2' :
          line.kind === 'table' ? '#f5f7f5' : '#f7faf7';
        ctx.fillRect(65, y - size, 711, lineHeight + 4);
        if (line.kind === 'quote') {
          ctx.fillStyle = '#83a28b';
          ctx.fillRect(66, y - size, 3, lineHeight + 4);
        }
      }
      ctx.font = italic + weight + size + 'px ' + fontFamily;
      ctx.fillStyle = color;
      if (segment.trim()) ctx.fillText(segment, 66 + indent, y);
      y += lineHeight;
    }
    y += gap;
  }
  await finishPage();
  const chunks = [];
  const offsets = [0];
  let position = 0;
  const push = (part) => {
    chunks.push(part); position += part.length;
  };
  const pushText = (value) => push(pdfBytes(value));
  pushText('%PDF-1.4\n');
  const begin = (id) => { offsets[id] = position; pushText(id + ' 0 obj\n'); };
  const end = () => pushText('endobj\n');
  begin(1); pushText('<< /Type /Catalog /Pages 2 0 R >>\n'); end();
  const ids = pages.map((_, i) => 3 + i * 3);
  begin(2); pushText('<< /Type /Pages /Count ' + pages.length +
    ' /Kids [' + ids.map((id) => id + ' 0 R').join(' ') + '] >>\n'); end();
  for (let i = 0; i < pages.length; i++) {
    const id = ids[i], jpeg = pages[i];
    begin(id);
    pushText('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im ' +
      (id + 1) + ' 0 R >> >> /Contents ' + (id + 2) + ' 0 R >>\n'); end();
    begin(id + 1);
    pushText('<< /Type /XObject /Subtype /Image /Width 840 /Height 1190 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
      jpeg.length + ' >>\nstream\n');
    push(jpeg); pushText('\nendstream\n'); end();
    const commands = 'q\n595 0 0 842 0 0 cm\n/Im Do\nQ\n';
    begin(id + 2);
    pushText('<< /Length ' + pdfBytes(commands).length + ' >>\nstream\n' + commands + 'endstream\n'); end();
  }
  const startXref = position;
  const total = 3 + pages.length * 3;
  pushText('xref\n0 ' + total + '\n0000000000 65535 f \n');
  for (let i = 1; i < total; i++)
    pushText(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
  pushText('trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + startXref + '\n%%EOF');
  const fileName = (String(note.heading || 'note').normalize('NFKD')
    .replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'note') + '.pdf';
  const file = new File(chunks, fileName, { type: 'application/pdf' });
  if (file.size > 20 * 1024 * 1024) throw new Error('PDF is too large for My Files.');
  return file;
}

export async function saveNotePdfToVault(file) {
  async function response(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not save PDF to My Files.');
    return data;
  }
  const id = crypto.randomUUID();
  const parts = [];
  const chunkSize = 2 * 1024 * 1024;
  for (let i = 0; i < Math.ceil(file.size / chunkSize); i++) {
    const piece = file.slice(i * chunkSize, (i + 1) * chunkSize);
    parts.push(await response(await fetch('/api/vault/media?action=upload-chunk&id=' + id +
      '&part=' + i, {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: piece,
    })));
  }
  return response(await fetch('/api/vault/media', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'upload-file', id, name: file.name, type: 'application/pdf',
      size: file.size, folderId: null,
      parts: parts.map((part) => ({ sha: part.sha, size: part.size })),
    }),
  }));
}
