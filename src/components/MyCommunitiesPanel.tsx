import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import Link from 'next/link';

export default async function MyCommunitiesPanel() {
  const profileId = await getCurrentProfileId();
  if (!profileId) return null;

  const rows = await prisma.spaceMembership.findMany({
    where: { profileId },
    include: { space: { select: { slug: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (rows.length === 0) return null;

  return (
    <div className="rounded-md border p-3">
      <div className="font-semibold mb-2">My Communities</div>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.space.slug}>
            <Link className="text-teal-700 hover:underline" href={`/space/${row.space.slug}`}>
              #{row.space.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
