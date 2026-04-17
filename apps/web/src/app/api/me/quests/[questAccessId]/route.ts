import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDictionary } from "@/lib/i18n";
import {
  applyQuestSessionCookie,
  getActivePlayerSessionFromCookies,
  getOwnedQuestSummaryForSession,
} from "@/lib/quests/questAccessSession";

type RouteContext = {
  params: Promise<{
    questAccessId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const t = getDictionary();
  const { questAccessId } = await context.params;
  const cookieStore = await cookies();
  const session = await getActivePlayerSessionFromCookies(cookieStore, {
    touch: true,
  });

  if (!session) {
    return NextResponse.json({ error: t.api.missingQuestAccess }, { status: 401 });
  }

  const quest = await getOwnedQuestSummaryForSession(
    session.session,
    questAccessId
  );

  if (!quest) {
    return NextResponse.json({ error: t.api.unknownQuestAccess }, { status: 404 });
  }

  const response = NextResponse.json({ quest });
  applyQuestSessionCookie(response, session.token, session.expiresAt);
  return response;
}
