import { NextResponse } from "next/server";

export async function GET() {
  const cmsUrl = process.env.CMS_URL || process.env.NEXT_PUBLIC_CMS_URL;
  const token = process.env.STRAPI_API_TOKEN;

  if (!cmsUrl) {
    return NextResponse.json({ ok: false, error: "Missing CMS_URL" }, { status: 500 });
  }
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing STRAPI_API_TOKEN" }, { status: 500 });
  }

  // Get first step by order
  const res = await fetch(
    `${cmsUrl}/api/quest-steps?sort=order:asc&pagination[pageSize]=1`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { ok: false, error: `Strapi error ${res.status}`, details: text },
      { status: 502 }
    );
  }

  const json = await res.json();
  const step = json?.data?.[0];

  if (!step) {
    return NextResponse.json({ ok: true, data: null });
  }

  // Return ONLY safe fields
  const safe = {
    id: step.id,
    documentId: step.documentId,
    order: step.order,
    title: step.title,
    flavorText: step.flavorText,
    successText: step.successText,
    latitude: step.latitude,
    longitude: step.longitude,
    radiusMeters: step.radiusMeters,
    puzzleType: step.puzzleType,
    puzzleDataPublic: step.puzzleDataPublic,
  };

  return NextResponse.json({ ok: true, data: safe });
}
