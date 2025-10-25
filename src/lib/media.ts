// src/lib/media.ts

const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL ?? '';

export function mediaUrlFromKey(key: string): string {
  return publicBaseUrl ? `${publicBaseUrl}/${key}` : key;
}

export type VariantRecord = {
  id: string;
  variants: {
    role: string;
    key: string;
    width: number;
    height: number;
    contentType: string;
  }[];
};

export type SerializedAttachment = {
  mediaId: string;
  role: string;
  url: string;
  width: number;
  height: number;
  contentType: string;
};

export function serializeAttachments(records: VariantRecord[], order?: string[]): SerializedAttachment[] {
  const map = new Map(records.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const sequence = order && order.length ? order : records.map((r) => r.id);
  const attachments: SerializedAttachment[] = [];

  for (const id of sequence) {
    const record = map.get(id);
    if (!record || seen.has(id)) continue;
    attachments.push(
      ...record.variants.map((v) => ({
        mediaId: record.id,
        role: v.role,
        url: mediaUrlFromKey(v.key),
        width: v.width,
        height: v.height,
        contentType: v.contentType,
      }))
    );
    seen.add(id);
  }

  for (const record of records) {
    if (seen.has(record.id)) continue;
    attachments.push(
      ...record.variants.map((v) => ({
        mediaId: record.id,
        role: v.role,
        url: mediaUrlFromKey(v.key),
        width: v.width,
        height: v.height,
        contentType: v.contentType,
      }))
    );
  }

  return attachments;
}
