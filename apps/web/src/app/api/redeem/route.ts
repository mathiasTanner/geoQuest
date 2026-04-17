import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  applyQuestSessionCookie,
  redeemQuestCodeForSession,
} from "@/lib/quests/questAccessSession";
import { getDictionary } from "@/lib/i18n";
import { takeRateLimitHit } from "@/lib/security/rateLimit";
import { isSameOriginWrite } from "@/lib/security/sameOrigin";

type RedeemRequestBody = {
  code?: string;
};

export async function POST(request: NextRequest) {
  const t = getDictionary();

  if (!isSameOriginWrite(request)) {
    return NextResponse.json({ error: t.api.invalidOrigin }, { status: 403 });
  }

  const rateLimitKey =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const rateLimit = await takeRateLimitHit(`redeem:${rateLimitKey}`, 10, 15 * 60 * 1000);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: t.api.tooManyRedeemAttempts },
      { status: 429 }
    );
  }

  const body = (await request.json()) as RedeemRequestBody;
  const code = String(body?.code ?? "").trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: t.api.missingCode }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const redeemed = await redeemQuestCodeForSession(code, cookieStore);
    const response = NextResponse.json({
      success: true,
      recovered: redeemed.recovered,
      questAccessId: redeemed.summary.questAccessId,
      restartCurrentStep: redeemed.summary.restartCurrentStep,
      warningMessage: redeemed.summary.warningMessage,
      resumeHref: redeemed.summary.playHref,
      quest: {
        title: redeemed.summary.questTitle,
        slug: redeemed.summary.questSlug,
      },
    });

    applyQuestSessionCookie(
      response,
      redeemed.session.token,
      redeemed.session.expiresAt
    );

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to redeem quest code";
    const status =
      message === "Invalid redemption code" ? 404 :
      message === "This quest purchase is not ready yet." ? 409 :
      500;
    const errorMessage =
      message === "Invalid redemption code"
        ? t.redeem.invalidCode
        : message === "This quest purchase is not ready yet."
          ? t.redeem.notReady
          : message;

    if (status === 404) {
      console.warn("Invalid redemption code attempt", {
        codePrefix: code.slice(0, 3),
        rateLimitKey,
      });
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
