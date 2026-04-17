import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  applyQuestSessionCookie,
  getActivePlayerSessionFromCookies,
  listOwnedQuestSummariesForSession,
} from "@/lib/quests/questAccessSession";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getActivePlayerSessionFromCookies(cookieStore, {
    touch: true,
  });

  if (!session) {
    return NextResponse.json({ quests: [] });
  }

  const quests = await listOwnedQuestSummariesForSession(session.session);
  const response = NextResponse.json({ quests });
  applyQuestSessionCookie(response, session.token, session.expiresAt);
  return response;
}
