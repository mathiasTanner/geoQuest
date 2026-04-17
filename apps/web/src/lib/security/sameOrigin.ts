import type { NextRequest } from "next/server";

export function isSameOriginWrite(request: NextRequest) {
  const allowedOrigins = new Set<string>([request.nextUrl.origin]);

  if (process.env.NEXT_PUBLIC_APP_URL) {
    allowedOrigins.add(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""));
  }

  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins.has(origin.replace(/\/$/, ""))) {
    return false;
  }

  const referer = request.headers.get("referer");
  if (!origin && referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!allowedOrigins.has(refererOrigin.replace(/\/$/, ""))) {
        return false;
      }
    } catch {
      return false;
    }
  }

  if (!origin && !referer) {
    const fetchSite = request.headers.get("sec-fetch-site");
    return fetchSite === "same-origin";
  }

  return true;
}
