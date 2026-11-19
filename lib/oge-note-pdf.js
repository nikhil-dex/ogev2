// Simple readable PDF export, entirely in the browser. Canvas handles Unicode
// text using the user's installed fonts; no external PDF service or package.
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
    { text: subjectName, size: 18, color: '#68756b' },
    { text: note.heading || 'Untitled Note', size: 32, color: '#243629' },
    { text: '', size: 20 },
    ...String(note.answer || '').replace(/\r/g, '').split('\n').map((line) => {
      const heading = /^(#{1,6})\s+/.exec(line);
      return { text: line.replace(/^#{1,6}\s+/, '').replace(/\*\*|__/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, ''),
        size: heading ? 25 : 20, color: '#243629' };
    }),
  ];
  for (const line of lines) {
    if (pages.length > 70) throw new Error('Note is too long for PDF export.');
    ctx.font = line.size + 'px sans-serif';
    ctx.fillStyle = line.color || '#243629';
    const wrap = [];
    let running = '';
    for (const word of (line.text || '').split(/(\s+)/)) {
      if (ctx.measureText(running + word).width <= 710) { running += word; continue; }
      if (running) { wrap.push(running); running = ''; }
      for (const ch of word) {
        if (ctx.measureText(running + ch).width > 710 && running) {
          wrap.push(running); running = '';
        }
        running += ch;
      }
    }
    wrap.push(running);
    for (const segment of wrap) {
      if (y > 1090) { await finishPage(); newPage(); ctx.font = line.size + 'px sans-serif'; }
      if (segment.trim()) ctx.fillText(segment, 66, y);
      y += line.size + 11;
    }
    y += 4;
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
    pushText('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im 0 ' +
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
