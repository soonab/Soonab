'use client';
import * as React from 'react';

type SpaceConfigResponse = { space?: { id?: string } | null };
type Post = { id: string; body: string; createdAt: string };
type PostsResponse = { posts?: Post[] };

export default function SpaceFeedPage({ params }: { params: { slug: string } }) {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [spaceId, setSpaceId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const cfgRes = await fetch(`/api/spaces/${params.slug}/config`);
        if (!cfgRes.ok) return;
        const cfg = (await cfgRes.json()) as SpaceConfigResponse;
        const id = cfg.space?.id ?? null;
        if (!isMounted) return;
        setSpaceId(id);
        if (!id) return;

        const postsRes = await fetch(`/api/posts?spaceId=${id}`);
        if (!postsRes.ok) {
          if (isMounted) setPosts([]);
          return;
        }

        const data = (await postsRes.json()) as PostsResponse;
        if (isMounted) setPosts(data.posts ?? []);
      } catch (error) {
        if (isMounted) {
          setSpaceId(null);
          setPosts([]);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [params.slug]);

  return (
    <main className="space-y-4">
      {!spaceId ? <p className="text-sm text-gray-500">Loading…</p> : null}
      {posts.map((post) => (
        <article key={post.id} className="rounded border p-3">
          <p className="whitespace-pre-wrap text-sm">{post.body}</p>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(post.createdAt).toLocaleString()}
          </div>
        </article>
      ))}
      {spaceId && posts.length === 0 ? (
        <p className="text-sm text-gray-500">No posts yet.</p>
      ) : null}
    </main>
  );
}
