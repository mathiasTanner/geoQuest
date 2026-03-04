import { NextResponse } from "next/server";
import { haversineDistanceMeters } from "@/lib/geo/distanceServer";

type Submission = {
  stepDocumentId: string;
  answer: string;
  coords: { lat: number; lng: number; accuracy: number };
  submittedAt: number;
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export async function POST(req: Request) {
  const body = (await req.json()) as Submission;

  if (!body?.stepDocumentId || !body?.coords || typeof body.answer !== "string") {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const cmsUrl = process.env.CMS_URL || process.env.NEXT_PUBLIC_CMS_URL;
  if (!cmsUrl) {
    return NextResponse.json({ ok: false, error: "Missing CMS_URL" }, { status: 500 });
  }

  // Fetch step from Strapi
  const token = process.env.STRAPI_API_TOKEN;

  const stepRes = await fetch(
    `${cmsUrl}/api/quest-steps/${body.stepDocumentId}?populate=quest`,
    { cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : undefined }
  );

  
  if (!stepRes.ok) {
    const text = await stepRes.text();
    return NextResponse.json(
      { ok: false, error: `Failed to fetch step: ${stepRes.status}`, details: text },
      { status: 502 }
    );
  }

  const stepJson = await stepRes.json();
  const step = stepJson?.data;

  if (!step) {
    return NextResponse.json({ ok: false, error: "Step not found" }, { status: 404 });
  }

  const target = { lat: Number(step.latitude), lng: Number(step.longitude) };
  const radiusMeters = Number(step.radiusMeters);

  const distance = haversineDistanceMeters(
    { lat: body.coords.lat, lng: body.coords.lng },
    target
  );

  // fairness: don't block players if GPS accuracy is poor
  const accuracy = Number(body.coords.accuracy ?? 0);
  const buffer = Math.max(accuracy, 10);
  const effectiveRadius = radiusMeters + buffer;
  const locationOk = distance <= effectiveRadius;


  // validate answer (text only for now)
  const puzzleType = step.puzzleType;
  let answerOk = false;

  if (puzzleType === "text") {
    const accepted: string[] = step.puzzleDataPrivate?.acceptedAnswers ?? [];
    answerOk = accepted.map(normalize).includes(normalize(body.answer));
  } else {
    return NextResponse.json(
      { ok: false, error: `Unsupported puzzleType for validation yet: ${puzzleType}` },
      { status: 400 }
    );
  }

  const unlocked = locationOk && answerOk;

  let nextStepDocumentId: string | null = null;

  if (unlocked) {
    const questDocumentId = step.quest?.documentId;
    const nextOrder = Number(step.order) + 1;

    if (questDocumentId) {
      const nextRes = await fetch(
        `${cmsUrl}/api/quest-steps?filters[quest][documentId][$eq]=${encodeURIComponent(
          questDocumentId
        )}&filters[order][$eq]=${nextOrder}&pagination[pageSize]=1`,
        {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );

      if (nextRes.ok) {
        const nextJson = await nextRes.json();
        const nextStep = nextJson?.data?.[0];
        nextStepDocumentId = nextStep?.documentId ?? null;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    unlocked,
    nextStepDocumentId,
    checks: {
      locationOk,
      answerOk,
      distanceMeters: Math.round(distance),
      radiusMeters,
      bufferMeters: Math.round(buffer),
      effectiveRadiusMeters: Math.round(effectiveRadius),
      accuracyMeters: Math.round(accuracy),
    },
  });
}
