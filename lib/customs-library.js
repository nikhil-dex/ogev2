import { readdir } from 'node:fs/promises';
import path from 'node:path';

const TYPES = new Map([
  ['.html', 'HTML'], ['.htm', 'HTML'],
  ['.pdf', 'PDF'],
  ['.png', 'Image'], ['.jpg', 'Image'], ['.jpeg', 'Image'],
  ['.webp', 'Image'], ['.gif', 'Image'], ['.avif', 'Image'],
]);

// Files are ordinary assets in public/customs, just like the original
// ogenotes HTML library. The folder is optional: no folder, no section.
export async function listCustomsFiles(root = process.cwd()) {
  let entries;
  try {
    entries = await readdir(path.join(root, 'public', 'customs'), { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, files: [] };
    throw error;
  }
  const files = entries
    .filter((entry) => entry.isFile() && TYPES.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => {
      const type = TYPES.get(path.extname(entry.name).toLowerCase());
      const title = entry.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || entry.name;
      return { name: entry.name, title, type, url: '/customs/' + encodeURIComponent(entry.name) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return { exists: true, files };
}
