'use server';

import { auth } from '../../auth.js';
import { getDatabase } from '../../lib/mongodb.js';
import { redirect } from 'next/navigation';
import { ownerMutationFilter } from '../../lib/active-owner-mutation.js';
import { validateHomeModules } from '../../lib/home-modules.js';

export async function saveHomeModules(formData) {
  const session = await auth();
  if (!session?.user?.id) redirect('/register');
  const modules = formData.getAll('homeModule');
  if (!validateHomeModules(modules)) throw new Error('Invalid homepage module selection.');
  const db = await getDatabase();
  const result = await db.collection('users').updateOne(
    ownerMutationFilter(session.user.id, { sessionVersion: session.user.sessionVersion }),
    { $set: { homeModules: modules, updatedAt: new Date() } },
  );
  if (result.matchedCount !== 1) redirect('/register');
  redirect('/settings#homepage-modules');
}
