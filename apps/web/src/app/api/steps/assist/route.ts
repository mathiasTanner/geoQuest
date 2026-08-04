import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  applyQuestSessionCookie,
  assistOwnedQuestStep,
  getOwnedQuestSummaryForSession,
  getActivePlayerSessionFromCookies,
} from "@/lib/quests/questAccessSession";
import { getDictionary } from "@/lib/i18n";
import { takeRateLimitHit } from "@/lib/security/rateLimit";
import { isSameOriginWrite } from "@/lib/security/sameOrigin";

type AssistPayload = {
  action: "hint" | "reveal";
  questAccessId: string;
  stepDocumentId: string;
  submission: unknown;
  version: number;
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
    `assist:${rateLimitKey}`,
    40,
    5 * 60 * 1000
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: t.api.tooManySubmissions },
      { status: 429 }
    );
  }

  const body = (await request.json()) as AssistPayload;

  if (
    !body?.questAccessId ||
    !body?.stepDocumentId ||
    !body?.submission ||
    (body.action !== "hint" && body.action !== "reveal") ||
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
    const result = await assistOwnedQuestStep({
      action: body.action,
      questAccessId: body.questAccessId,
      stepDocumentId: body.stepDocumentId,
      submission: body.submission,
      version: Number(body.version),
    });

    const response = NextResponse.json(result);
    applyQuestSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t.api.genericStepError;
    const status =
      message === "Quest access not found" || message === "Quest step not found"
        ? 404
        : message === "Quest progress is stale. Please reload and try again." ||
            message === "This step is not the current step for the quest."
          ? 409
          : message.startsWith("Unsupported puzzleType") ||
              message.includes("invalid") ||
              message === t.step.assistNoHintsRemaining ||
              message === t.step.assistRevealAlreadyUsed
            ? 400
            : 500;

    const localizedMessage =
      message === "Quest access not found"
        ? t.api.unknownQuestAccess
        : message === "Quest step not found"
          ? t.api.unknownStep
          : message === "Quest progress is stale. Please reload and try again."
            ? t.api.staleProgress
            : message === "This step is not the current step for the quest."
              ? t.api.wrongCurrentStep
              : message;

    const response = NextResponse.json(
      { ok: false, error: localizedMessage },
      { status }
    );
    applyQuestSessionCookie(response, session.token, session.expiresAt);
    return response;
  }
}
