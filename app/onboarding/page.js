import Link from 'next/link';
import { auth } from '../../auth.js';
import { getDatabase } from '../../lib/mongodb.js';
import { redirect } from 'next/navigation';
import OnboardingWizard from './onboarding-wizard.js';

export const metadata = { title: 'Welcome to Oge · Set up your workspace' };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) redirect('/register');
  const db = await getDatabase();
  const user = await db.collection('users').findOne(
    { googleSub: ownerId },
    { projection: { onboardingComplete: 1, newsInterests: 1, notesStorage: 1 } },
  );
  if (user?.onboardingComplete) redirect('/');
  return (
    <main className="shell oge-onboarding-page oge-onboarding-shell">
      <Link className="oge-brand" href="/"><span className="oge-brand-mark">O</span><span>OgeNotes</span></Link>
      <OnboardingWizard
        initialInterests={Array.isArray(user?.newsInterests) ? user.newsInterests : []}
        initialStorage={user?.notesStorage || ''} />
    </main>
  );
}
