'use server';

import { auth } from '../../auth.js';
import { getDatabase } from '../../lib/mongodb.js';
import { redirect } from 'next/navigation';
import { ownerMutationFilter } from '../../lib/active-owner-mutation.js';
import { validateOptionalFeatures } from '../../lib/optional-features.js';

export async function saveOptionalFeatures(formData) {
  const session = await auth();
  if (!session?.user?.id) redirect('/register');
  const features = formData.getAll('optionalFeature');
  if (!validateOptionalFeatures(features)) throw new Error('Invalid optional feature selection.');
  const db = await getDatabase();
  const result = await db.collection('users').updateOne(
    ownerMutationFilter(session.user.id, { sessionVersion: session.user.sessionVersion }),
    { $set: { optionalFeatures: features, updatedAt: new Date() } },
  );
  if (result.matchedCount !== 1) redirect('/register');
  redirect('/settings#optional-features');
}
