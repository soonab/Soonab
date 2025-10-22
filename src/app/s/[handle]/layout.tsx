import type { ReactNode } from 'react';
import type { Visibility } from '@prisma/client';

import ProfilePanel from '@/components/profile/ProfilePanel';
import { getCurrentProfileId } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function ProfileLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const decoded = decodeURIComponent(handle).toLowerCase();
  const viewerPid = await getCurrentProfileId();

  const profile = await prisma.profile.findUnique({
    where: { handle: decoded },
    select: {
      id: true,
      handle: true,
      bio: true,
      bioVisibility: true,
      location: true,
      locationVisibility: true,
      links: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, url: true, visibility: true },
      },
      orgVerifications: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { status: true, orgName: true, domain: true },
      },
    },
  });

  if (!profile) {
    return <>{children}</>;
  }

  let allowed: Visibility[] = ['PUBLIC'];
  const isOwner = viewerPid === profile.id;

  if (isOwner) {
    allowed = ['PUBLIC', 'FOLLOWERS', 'TRUSTED'];
  } else if (viewerPid) {
    const [youFollowThem, theyTrustYou] = await Promise.all([
      prisma.follow
        .findUnique({
          where: {
            followerProfileId_followingProfileId: {
              followerProfileId: viewerPid,
              followingProfileId: profile.id,
            },
          },
          select: { followerProfileId: true },
        })
        .then(Boolean),
      prisma.trust
        .findUnique({
          where: {
            trusterProfileId_trusteeProfileId: {
              trusterProfileId: profile.id,
              trusteeProfileId: viewerPid,
            },
          },
          select: { trusterProfileId: true },
        })
        .then(Boolean),
    ]);

    if (youFollowThem) allowed.push('FOLLOWERS');
    if (theyTrustYou) allowed.push('TRUSTED');
  }

  const canSee = (visibility: Visibility) => allowed.includes(visibility);

  const latestOrgVerification = profile.orgVerifications[0];

  const panelProfile = {
    handle: profile.handle,
    bio: canSee(profile.bioVisibility) ? profile.bio : null,
    location: canSee(profile.locationVisibility) ? profile.location : null,
    links: profile.links
      .filter((link) => canSee(link.visibility))
      .map((link) => ({ id: link.id, title: link.title, url: link.url })),
    orgVerified:
      latestOrgVerification?.status === 'VERIFIED'
        ? {
            orgName: latestOrgVerification.orgName,
            domain: latestOrgVerification.domain,
          }
        : null,
  };

  return (
    <div className="space-y-6">
      <ProfilePanel profile={panelProfile} />
      {children}
    </div>
  );
}
