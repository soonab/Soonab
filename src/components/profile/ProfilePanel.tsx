'use client';

export default function ProfilePanel({
  profile,
}: {
  profile: {
    handle: string;
    bio?: string | null;
    location?: string | null;
    links?: { id: string; title: string; url: string }[];
    orgVerified?: { orgName: string; domain: string } | null;
  };
}) {
  return (
    <div className="rounded border bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">@{profile.handle}</h2>
        {profile.orgVerified && (
          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
            Verified — {profile.orgVerified.orgName}
          </span>
        )}
      </div>

      {profile.bio ? <p className="mt-2 text-sm">{profile.bio}</p> : null}

      <div className="mt-3 grid gap-2 text-sm">
        {profile.location ? (
          <div className="text-gray-600">
            <span className="mr-1">📍</span>
            {profile.location}
          </div>
        ) : null}

        {!!profile.links?.length && (
          <div className="flex flex-wrap gap-2">
            {profile.links!.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded border px-2 py-1 text-xs hover:bg-gray-50"
              >
                {l.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
