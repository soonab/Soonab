import PersonalSpaceTile from '@/components/profile/PersonalSpaceTile';
import { getCurrentProfileId } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function ProfilePersonalSpaceSection({ handle }: { handle: string }) {
  const target = await prisma.profile.findUnique({ where: { handle }, select: { id: true } });
  if (!target) return null;

  const me = await getCurrentProfileId();
  if (!me || me !== target.id) return null;

  const personal = await prisma.space.findFirst({
    where: { createdById: me, isPersonal: true },
    select: { slug: true },
  });

  return <PersonalSpaceTile existingSlug={personal?.slug ?? null} />;
}
