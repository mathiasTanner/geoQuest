import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { generateRedemptionCode } from "@/lib/purchases/generateRedemptionCode";

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
        buyerEmail,
        stripeSessionId,
      });

      return NextResponse.json(
        { error: "Missing required webhook data" },
        { status: 400 }
      );
    }

    const cmsUrl =
      process.env.CMS_URL ??
      process.env.NEXT_PUBLIC_CMS_URL ??
      "http://localhost:1337";

    const existingRes = await fetch(
      `${cmsUrl}/api/quest-purchases?filters[stripeSessionId][$eq]=${stripeSessionId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (!existingRes.ok) {
      console.error("Failed to check existing Quest Purchase");
      return NextResponse.json(
        { error: "Failed to check existing purchase" },
        { status: 500 }
      );
    }

    const existingJson = await existingRes.json();
    const existingPurchase = existingJson?.data?.[0];

    if (existingPurchase) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const redemptionCode = generateRedemptionCode();

    const createRes = await fetch(`${cmsUrl}/api/quest-purchases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
      },
      body: JSON.stringify({
        data: {
          quest: questDocumentId,
          stripeSessionId,
          buyerEmail,
          redemptionCode,
          purchaseStatus: "paid",
        },
      }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error("Failed to create Quest Purchase", errorText);

      return NextResponse.json(
        { error: "Failed to create Quest Purchase" },
        { status: 500 }
      );
    }

    console.log("Quest Purchase created", {
      stripeSessionId,
      buyerEmail,
      redemptionCode,
      questDocumentId,
    });
  }

  return NextResponse.json({ received: true });
}