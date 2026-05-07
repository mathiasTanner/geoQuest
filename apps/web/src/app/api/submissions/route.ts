import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  advanceOwnedQuestProgress,
  applyQuestSessionCookie,
  getActivePlayerSessionFromCookies,
  getOwnedQuestSummaryForSession,
} from "@/lib/quests/questAccessSession";
import { getDictionary } from "@/lib/i18n";
import { takeRateLimitHit } from "@/lib/security/rateLimit";
import { isSameOriginWrite } from "@/lib/security/sameOrigin";

type Submission = {
  questAccessId: string;
  stepDocumentId: string;
  answer: string;
  version: number;
  coords: { lat: number; lng: number; accuracy: number };
  submittedAt?: number;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const t = getDictionary();

  if (!isSameOriginWrite(request)) {
    return NextResponse.json({ ok: false, error: t.api.invalidOrigin }, { status: 403 });
  }

  const rateLimitKey =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const rateLimit = await takeRateLimitHit(
    `submission:${rateLimitKey}`,
    30,
    5 * 60 * 1000
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: t.api.tooManySubmissions },
      { status: 429 }
    );
  }

  const body = (await request.json()) as Submission;

  if (
    !body?.questAccessId ||
    !body?.stepDocumentId ||
    !body?.coords ||
    typeof body.answer !== "string" ||
    !Number.isFinite(Number(body.version))
  ) {
    return NextResponse.json({ ok: false, error: t.api.invalidPayload }, { status: 400 });
  }

  const cookieStore = await cookies();
  const session = await getActivePlayerSessionFromCookies(cookieStore, {
    touch: true,
  });

  if (!session) {
    return NextResponse.json(
      { ok: false, error: t.api.missingQuestAccess },
      { status: 401 }
    );
  }

  const ownedQuest = await getOwnedQuestSummaryForSession(
    session.session,
    body.questAccessId
  );

  if (!ownedQuest) {
    return NextResponse.json(
      { ok: false, error: t.api.unknownQuestAccess },
      { status: 404 }
    );
  }

  try {
    const result = await advanceOwnedQuestProgress({
      questAccessId: body.questAccessId,
      stepDocumentId: body.stepDocumentId,
      answer: body.answer,
      version: Number(body.version),
      coords: {
        lat: Number(body.coords.lat),
        lng: Number(body.coords.lng),
        accuracy: Number(body.coords.accuracy ?? 0),
      },
    });

    const response = NextResponse.json(result);
    applyQuestSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t.api.genericStepError;
    const localizedMessage =
      message === "Quest access not found"
        ? t.api.unknownQuestAccess
        : message === "Quest step not found"
          ? t.api.unknownStep
          : message === "Quest progress is stale. Please reload and try again."
              || message === "Quest progress is being updated. Please reload and try again."
            ? t.api.staleProgress
            : message === "This step is not the current step for the quest."
              ? t.api.wrongCurrentStep
              : message.startsWith("Unsupported puzzleType")
                ? t.step.unsupportedPuzzle
                : message;

    const status =
        message === "Quest access not found" ||
        message === "Quest step not found"
          ? 404
          : message === "Quest progress is stale. Please reload and try again." ||
              message === "Quest progress is being updated. Please reload and try again." ||
              message === "This step is not the current step for the quest."
            ? 409
          : message.startsWith("Unsupported puzzleType")
            ? 400
            : 500;

    const response = NextResponse.json(
      { ok: false, error: localizedMessage },
      { status }
    );
    applyQuestSessionCookie(response, session.token, session.expiresAt);
    return response;
  }
}
