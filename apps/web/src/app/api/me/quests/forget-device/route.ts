import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDictionary } from "@/lib/i18n";
import {
  applyQuestSessionCookie,
  forgetQuestAccessForSession,
  getActivePlayerSessionFromCookies,
} from "@/lib/quests/questAccessSession";
import { isSameOriginWrite } from "@/lib/security/sameOrigin";

export const dynamic = "force-dynamic";

type ForgetDevicePayload = {
  questAccessId?: string;
};

export async function POST(request: NextRequest) {
  const t = getDictionary();

  if (!isSameOriginWrite(request)) {
    return NextResponse.json({ error: t.api.invalidOrigin }, { status: 403 });
  }

  const cookieStore = await cookies();
  const session = await getActivePlayerSessionFromCookies(cookieStore, {
    touch: true,
  });

  if (!session) {
    return NextResponse.json(
      { error: t.api.missingQuestAccess },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | ForgetDevicePayload
    | null;
  const questAccessId =
    body && typeof body.questAccessId === "string" ? body.questAccessId : null;

  if (!questAccessId) {
    return NextResponse.json(
      { error: t.api.unknownQuestAccess },
      { status: 400 }
    );
  }

  try {
    await forgetQuestAccessForSession(session.session, questAccessId);
    const response = NextResponse.json({ success: true });
    applyQuestSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && process.env.NODE_ENV !== "production"
            ? error.message
            : t.forgetDevice.genericError,
      },
      { status: 400 }
    );
  }
}
