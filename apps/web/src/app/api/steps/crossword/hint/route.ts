import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  applyQuestSessionCookie,
  getActivePlayerSessionFromCookies,
  getCrosswordHintForOwnedQuest,
} from "@/lib/quests/questAccessSession";
import { getDictionary } from "@/lib/i18n";
import { takeRateLimitHit } from "@/lib/security/rateLimit";
import { isSameOriginWrite } from "@/lib/security/sameOrigin";

type HintRequestBody = {
  questAccessId: string;
  stepDocumentId: string;
  cells: Record<string, string>;
  hintCountUsed: number;
  currentHintClueId?: string | null;
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
    `crossword-hint:${rateLimitKey}`,
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
    !body.cells ||
    typeof body.cells !== "object" ||
    Array.isArray(body.cells) ||
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
    const hint = await getCrosswordHintForOwnedQuest(
      session.session,
      body.questAccessId,
      body.stepDocumentId,
      body.cells,
      Number(body.hintCountUsed),
      typeof body.currentHintClueId === "string" ? body.currentHintClueId : null,
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
              : message === "Hints are disabled for this crossword."
                ? t.step.crosswordHintsDisabled
                : message === "No hints remaining."
                  ? t.step.crosswordNoHintsRemaining
                  : message === "No crossword hint available."
                    ? t.step.crosswordHintUnavailable
                    : message;

    const status =
      message === "Quest access not found" || message === "Quest step not found"
        ? 404
        : message === "This step is not the current step for the quest."
          ? 409
          : message.startsWith("Unsupported puzzleType")
            ? 400
            : message === "Hints are disabled for this crossword." ||
                message === "No hints remaining." ||
                message === "No crossword hint available."
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
