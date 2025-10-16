// src/lib/pagination.ts
export type PostCursor = { createdAt: string; id: string };

export function encodeCursor(c: PostCursor | null) {
  return c ? Buffer.from(JSON.stringify(c)).toString('base64url') : null;
}

export function decodeCursor(s: string | null): PostCursor | null {
  if (!s) return null;
  try {
    return JSON.parse(Buffer.from(s, 'base64url').toString()) as PostCursor;
  } catch {
    return null;
  }
}
