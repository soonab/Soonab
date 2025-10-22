// File: src/app/api/media/sign/route.ts  (replace whole file)
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, requireCsrf, requireJson } from "@/lib/security";
import { z } from "@/lib/zod";
import { signPutURL } from "@/lib/media/s3";

const Body = z.object({
  contentType: z.string().trim().min(1),
  size: z.number().int().positive().max(80 * 1024 * 1024),
});

export async function POST(req: NextRequest) {
  // Security baseline
  const so = assertSameOrigin(req); if (so) return so;
  const cs = requireCsrf(req);      if (cs) return cs;

  // Parse + validate JSON body
  const { contentType, size } = await requireJson(req, Body);

  // Optional enforcement of a size ceiling via env
  const maxBytes = Number(process.env.MEDIA_MAX_BYTES || 8 * 1024 * 1024);
  if (size > maxBytes) {
    return NextResponse.json({ ok: false, error: `FILE_TOO_LARGE: limit ${maxBytes} bytes` }, { status: 413 });
  }

  // Quick env guard so we return JSON instead of throwing SDK errors
  const { AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;
  const regionOk = !!AWS_REGION && /^[a-z0-9-]+$/i.test(AWS_REGION);
  if (!regionOk || !AWS_S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return NextResponse.json(
      { ok: false, error: "MEDIA_NOT_CONFIGURED: set AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY" },
      { status: 503 }
    );
  }

  // Generate a simple storage key (customise if you like)
  const ext = contentType.split("/")[1] || "bin";
  const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  try {
    const { url, bucket, region } = await signPutURL({ key, contentType });
    return NextResponse.json({ ok: true, url, key, bucket, region, maxBytes });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: `SIGN_ERROR: ${err?.message || String(err)}` }, { status: 500 });
  }
}
