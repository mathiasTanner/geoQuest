import { NextRequest, NextResponse } from "next/server";
import {
  getCmsUrl,
  getStrapiApiToken,
} from "@/lib/purchases/questPurchaseWorkflow";
import {
  applyCheckoutStateCookie,
  createCheckoutStateToken,
} from "@/lib/purchases/checkoutState";
import { takeRateLimitHit } from "@/lib/security/rateLimit";
import { isSameOriginWrite } from "@/lib/security/sameOrigin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const rateLimitKey =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const rateLimit = await takeRateLimitHit(
    `checkout:${rateLimitKey}`,
    15,
    15 * 60 * 1000
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please wait a moment." },
      { status: 429 }
    );
  }
  const body = await req.json();
  const questSlug =
    typeof body?.questSlug === "string" ? body.questSlug.trim() : "";

  if (!questSlug) {
    return NextResponse.json(
      { error: "Missing questSlug" },
      { status: 400 }
    );
  }

  const cmsUrl = getCmsUrl();

  const res = await fetch(
    `${cmsUrl}/api/quests?filters[slug][$eq]=${encodeURIComponent(
      questSlug
    )}&populate[coverImage][fields][0]=url&populate[coverImage][fields][1]=alternativeText`,
    {
      headers: {
        Authorization: `Bearer ${getStrapiApiToken()}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch quest" },
      { status: 500 }
    );
  }

  const json = await res.json();
  const questEntry = json?.data?.[0];
  const quest = questEntry?.attributes ?? questEntry;

  if (!quest) {
    return NextResponse.json(
      { error: "Quest not found" },
      { status: 404 }
    );
  }

  if (!quest.stripePriceId) {
    return NextResponse.json(
      { error: "Quest is not purchasable yet" },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const checkoutState = createCheckoutStateToken();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: quest.stripePriceId,
        quantity: 1,
      },
    ],
    metadata: {
      questSlug,
      questDocumentId: questEntry?.documentId ?? "",
      checkoutState,
    },
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/quests/${questSlug}`,
  });

  const response = NextResponse.json({ url: session.url });
  applyCheckoutStateCookie(response, checkoutState);
  return response;
}
