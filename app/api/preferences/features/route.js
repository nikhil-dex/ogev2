import { auth } from '../../../../auth.js';
import { getDatabase } from '../../../../lib/mongodb.js';
import { ownerMutationFilter } from '../../../../lib/active-owner-mutation.js';
import { optionalFeatureEnabled } from '../../../../lib/optional-features.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDatabase();
  const user = await db.collection('users').findOne(
    ownerMutationFilter(session.user.id, { sessionVersion: session.user.sessionVersion }),
    { projection: { optionalFeatures: 1 } },
  );
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json({ news: optionalFeatureEnabled(user.optionalFeatures, 'news') }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
