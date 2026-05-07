import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  ensureQuestPurchaseForCheckout,
  getCmsUrl,
  getStrapiApiToken,
  maskEmail,
} from "@/lib/purchases/questPurchaseWorkflow";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const questDocumentId = session.metadata?.questDocumentId;
    const buyerEmail = session.customer_details?.email;
    const stripeSessionId = session.id;

    if (!questDocumentId || !buyerEmail) {
      console.error("Missing webhook data", {
        questDocumentId,
        buyerEmail: buyerEmail ? maskEmail(buyerEmail) : undefined,
        stripeSessionId,
      });

      return NextResponse.json(
        { error: "Missing required webhook data" },
        { status: 400 }
      );
    }

    const cmsUrl = getCmsUrl();
    let strapiApiToken: string;

    try {
      strapiApiToken = getStrapiApiToken();
    } catch {
      console.error("Missing STRAPI_API_TOKEN");
      return NextResponse.json(
        { error: "Missing STRAPI_API_TOKEN" },
        { status: 500 }
      );
    }

    try {
      const ensuredPurchase = await ensureQuestPurchaseForCheckout({
        buyerEmail,
        cmsUrl,
        questDocumentId,
        stripeSessionId,
        strapiApiToken,
      });

      console.log("Quest Purchase confirmed", {
        stripeSessionId,
        questDocumentId,
        buyerEmail: maskEmail(buyerEmail),
        duplicate: ensuredPurchase.duplicate,
      });

      return NextResponse.json({
        received: true,
        duplicate: ensuredPurchase.duplicate,
      });
    } catch (error) {
      console.error("Failed to process Quest Purchase", {
        stripeSessionId,
        questDocumentId,
        buyerEmail: maskEmail(buyerEmail),
        error,
      });

      return NextResponse.json(
        { error: "Failed to create Quest Purchase" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
