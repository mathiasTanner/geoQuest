import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  applyQuestSessionCookie,
  getActivePlayerSessionFromCookies,
  getWordsearchHintForOwnedQuest,
} from "@/lib/quests/questAccessSession";
import { getDictionary } from "@/lib/i18n";
import { takeRateLimitHit } from "@/lib/security/rateLimit";
import { isSameOriginWrite } from "@/lib/security/sameOrigin";

type HintRequestBody = {
  questAccessId: string;
  stepDocumentId: string;
  foundWordIds: string[];
  hintCountUsed: number;
  currentHintWordId?: string | null;
  currentHintLevel?: number | null;
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
    `wordsearch-hint:${rateLimitKey}`,
    60,
    5 * 60 * 1000
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: t.api.tooManySubmissions },
      { status: 429 }
    );
  }

  const body = (await request.json()) as HintRequestBody;

  if (
    !body?.questAccessId ||
    !body?.stepDocumentId ||
    !Array.isArray(body.foundWordIds) ||
    !Number.isInteger(Number(body.hintCountUsed))
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

  try {
    const hint = await getWordsearchHintForOwnedQuest(
      session.session,
      body.questAccessId,
      body.stepDocumentId,
      body.foundWordIds,
      Number(body.hintCountUsed),
      typeof body.currentHintWordId === "string" ? body.currentHintWordId : null,
      Number.isInteger(Number(body.currentHintLevel))
        ? Number(body.currentHintLevel)
        : null
    );

    const response = NextResponse.json({ ok: true, hint });
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
          : message === "This step is not the current step for the quest."
            ? t.api.wrongCurrentStep
            : message.startsWith("Unsupported puzzleType")
              ? t.step.unsupportedPuzzle
              : message === "Hints are disabled for this wordsearch."
                ? t.step.wordsearchHintsDisabled
                : message === "No hints remaining."
                  ? t.step.wordsearchNoHintsRemaining
                  : message === "No wordsearch hint available."
                    ? t.step.wordsearchHintUnavailable
                    : message;

    const status =
      message === "Quest access not found" || message === "Quest step not found"
        ? 404
        : message === "This step is not the current step for the quest."
          ? 409
          : message.startsWith("Unsupported puzzleType")
            ? 400
            : message === "Hints are disabled for this wordsearch." ||
                message === "No hints remaining." ||
                message === "No wordsearch hint available."
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
