// A complete repository manifest is read-only and contains no file bytes.
// Includes every committed tree entry, not merely Notes/Quick Notes/AirNotes.
const SHA = /^[a-f0-9]{40}$/i;
export async function readVaultBackupManifest(client) {
  const ref = await client.call('/git/ref/heads/' + encodeURIComponent(client.branch));
  const head = ref?.object?.sha;
  if (!SHA.test(head || '')) throw new TypeError('Invalid Vault HEAD.');
  const commit = await client.call('/git/commits/' + head);
  if (!SHA.test(commit?.tree?.sha || '')) throw new TypeError('Invalid Vault tree.');
  const tree = await client.call('/git/trees/' + commit.tree.sha + '?recursive=1');
  if (!Array.isArray(tree?.tree) || tree.truncated === true || tree.tree.length > 30000)
    throw new TypeError('Incomplete Vault tree.');
  const paths = tree.tree.filter((item) =>
    item.type === 'blob' && SHA.test(item.sha || '') && typeof item.path === 'string');
  const classes = {
    notes: 0, quickNotes: 0, airnotes: 0, savedLinks: 0,
    myFiles: 0, customs: 0, other: 0,
  };
  for (const file of paths) {
    const key = file.path.startsWith('notes/') ? 'notes' :
      file.path.startsWith('quick-notes/') ? 'quickNotes' :
      file.path.startsWith('airnotes/') ? 'airnotes' :
      file.path.startsWith('saved-links/') ? 'savedLinks' :
      file.path.startsWith('media/') || file.path.startsWith('files/') ? 'myFiles' :
      file.path.startsWith('customs/') ? 'customs' : 'other';
    classes[key]++;
  }
  const confirm = await client.call('/git/ref/heads/' + encodeURIComponent(client.branch));
  if (confirm?.object?.sha !== head) throw new TypeError('Vault changed during backup scan.');
  return { branch: client.branch, commitSha: head, totalCommittedFiles: paths.length,
    groups: classes, completeTree: true };
}
