import { auth } from '../auth.js';
import { getDatabase } from './mongodb.js';
import { ownerMutationFilter } from './active-owner-mutation.js';

// Never trust client-provided email or a mutable session display field.
// Check the verified sign-in's canonical persisted account on every request.
export function configuredAdminEmail(value = process.env.ADMIN_EMAIL) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function accountIsAdmin(account, expectedEmail) {
  return Boolean(expectedEmail && account && typeof account.email === 'string' &&
    account.email.trim().toLowerCase() === expectedEmail);
}

export async function requireOgeAdmin() {
  const expectedEmail = configuredAdminEmail();
  if (!expectedEmail) return null;
  const session = await auth();
  if (!session?.user?.id) return null;
  const db = await getDatabase();
  const account = await db.collection('users').findOne(
    ownerMutationFilter(session.user.id, { sessionVersion: session.user.sessionVersion }),
    { projection: { googleSub: 1, email: 1, name: 1, identityProvider: 1 } },
  );
  if (!accountIsAdmin(account, expectedEmail)) return null;
  return { db, ownerId: session.user.id, email: expectedEmail };
}
