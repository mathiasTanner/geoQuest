import { randomBytes } from "crypto";
import type { NextResponse } from "next/server";

export const CHECKOUT_STATE_COOKIE_NAME = "gq_checkout_state";

const CHECKOUT_STATE_TTL_MS = 2 * 60 * 60 * 1000;

export function createCheckoutStateToken() {
  return randomBytes(24).toString("base64url");
}

function getCheckoutStateExpiry() {
  return new Date(Date.now() + CHECKOUT_STATE_TTL_MS);
}

export function applyCheckoutStateCookie(
  response: NextResponse,
  token: string
) {
  response.cookies.set({
    name: CHECKOUT_STATE_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: getCheckoutStateExpiry(),
  });
}

export function clearCheckoutStateCookie(response: NextResponse) {
  response.cookies.set({
    name: CHECKOUT_STATE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}
