'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { requireOgeAdmin } from '../../lib/oge-admin.js';
import { deleteAccountDataAtomically } from '../../lib/account-deletion-transaction.js';
import { sessionVersionOf } from '../../lib/session-revocation.js';
import { adminDeletionFailureStatus } from '../../lib/oge-admin-delete-status.js';

export async function revokeAccountSessions(formData) {
  const admin = await requireOgeAdmin();
  if (!admin) redirect('/'); // No admin details or existence exposed.
  const targetId = formData.get('account');
  const confirmation = formData.get('confirmation');
  if (typeof targetId !== 'string' || !targetId || targetId.length > 180 ||
      confirmation !== 'REVOKE') redirect('/ogeadmin?status=invalid');
  // Keep admin signed in and avoid accidentally revoking their own session.
  if (targetId === admin.ownerId) redirect('/ogeadmin?status=self');
  const target = await admin.db.collection('users').findOne(
    { googleSub: targetId }, { projection: { email: 1 } },
  );
  if (!target) redirect('/ogeadmin?status=missing');
  if (target.email?.trim().toLowerCase() === admin.email)
    redirect('/ogeadmin?status=self');
  const result = await admin.db.collection('users').updateOne(
    { googleSub: targetId, email: target.email },
    { $set: { sessionVersion: randomUUID(), updatedAt: new Date() } },
  );
  redirect('/ogeadmin?status=' + (result.matchedCount ? 'revoked' : 'missing'));
}

/**
 * Delete a non-admin account using the same atomic data deletion engine
 * as self-service deletion. Connected GitHub Vaults / unfinished recovery
 * state are deliberately rejected by that engine, with no partial writes.
 */
export async function deleteManagedAccount(formData) {
  const admin = await requireOgeAdmin();
  if (!admin) redirect('/');
  const targetId = formData.get('account');
  const enteredEmail = formData.get('targetEmail');
  const confirmation = formData.get('confirmation');
  if (typeof targetId !== 'string' || !targetId || targetId.length > 180 ||
      typeof enteredEmail !== 'string' ||
      confirmation !== 'DELETE ACCOUNT') redirect('/ogeadmin?status=invalid');
  if (targetId === admin.ownerId) redirect('/ogeadmin?status=self');

  const target = await admin.db.collection('users').findOne(
    { googleSub: targetId },
    { projection: { email: 1, sessionVersion: 1 } },
  );
  if (!target) redirect('/ogeadmin?status=missing');
  const email = typeof target.email === 'string' ? target.email.trim().toLowerCase() : '';
  if (!email || email === admin.email) redirect('/ogeadmin?status=self');
  if (enteredEmail.trim().toLowerCase() !== email) redirect('/ogeadmin?status=invalid');
  const keepGithubRepository = formData.get('keepGithubRepository') === 'yes';
  if (formData.get('keepGithubRepository') !== 'yes' && formData.get('keepGithubRepository') !== null)
    redirect('/ogeadmin?status=invalid');
  const version = sessionVersionOf(target);
  if (version === null) redirect('/ogeadmin?status=blocked');

  try {
    await deleteAccountDataAtomically(admin.db, targetId, version, { keepGithubRepository });
  } catch (error) {
    // The shared deletion engine refuses connected GitHub repositories,
    // pending Vault drafts, conflicts and unsupported transactions.
    console.error('Admin account deletion failed:', error?.name);
    redirect('/ogeadmin?status=' + adminDeletionFailureStatus(error));
  }
  redirect('/ogeadmin?status=' + (keepGithubRepository ? 'deleted-repo-kept' : 'deleted'));
}
