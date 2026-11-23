'use server';

import { auth } from '../../auth.js';
import { getDatabase } from '../../lib/mongodb.js';
import { redirect } from 'next/navigation';
import { NEWS_TOPICS } from '../../lib/news-topics.js';
import { validateHomeModules } from '../../lib/home-modules.js';
import { validateOptionalFeatures } from '../../lib/optional-features.js';
import { ownerMutationFilter } from '../../lib/active-owner-mutation.js';

export async function saveNewsInterests(formData) {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (typeof ownerId !== 'string' || !ownerId) redirect('/register');

  const fromSettings = formData.get('returnTo') === '/settings';
  const storageChoice = fromSettings ? null : formData.get('notesStorage');
  // Storage choice alone must never complete onboarding before module choices.
  if (!fromSettings && formData.get('wizardComplete') !== 'true')
    throw new Error('Finish the homepage module selection step before connecting GitHub.');
  if (!fromSettings && !['mongodb', 'github'].includes(storageChoice))
    throw new Error('Choose MongoDB or GitHub Vault to store your Notes.');

  const action = formData.get('action');
  const submitted = action === 'skip' ? [] : formData.getAll('interest');
  if (submitted.length > 10) throw new Error('Choose no more than 10 news interests.');
  const interests = [...new Set(submitted.filter((item) => typeof item === 'string' && NEWS_TOPICS.includes(item)))];
  if (interests.length !== submitted.length) throw new Error('One or more selected interests are invalid. Please try again.');

  const selectedModules = fromSettings ? null : formData.getAll('homeModule');
  if (!fromSettings && !validateHomeModules(selectedModules))
    throw new Error('Choose valid homepage modules.');

  const selectedFeatures = fromSettings ? null : formData.getAll('optionalFeature');
  if (!fromSettings && !validateOptionalFeatures(selectedFeatures))
    throw new Error('Choose valid optional features.');

  const db = await getDatabase();
  const accountFilter = ownerMutationFilter(ownerId, { sessionVersion: session.user.sessionVersion });
  const result = await db.collection('users').updateOne(
    accountFilter,
    { $set: { newsInterests: interests, ...(fromSettings ? {} : { notesStorage: storageChoice, homeModules: selectedModules, optionalFeatures: selectedFeatures, onboardingComplete: true }), updatedAt: new Date() } },
  );
  if (result.matchedCount !== 1) redirect('/register');
  if (!fromSettings && storageChoice === 'github') redirect('/vault?setup=onboarding');
  redirect(fromSettings ? '/settings' : '/');
}
