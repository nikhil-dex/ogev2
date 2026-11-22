'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { requireOgeAdmin } from '../../lib/oge-admin.js';

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
