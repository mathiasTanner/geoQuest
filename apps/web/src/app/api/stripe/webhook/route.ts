import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  renderTemplate,
  sendQuestPurchaseEmail,
} from "@/lib/email/sendQuestPurchaseEmail";
import { getStripe } from "@/lib/stripe";
import { generateRedemptionCode } from "@/lib/purchases/generateRedemptionCode";

type StrapiEntity<T> = T & {
  attributes?: T;
  documentId?: string;
  id?: number;
};

type QuestData = {
  title: string;
};

type PurchaseEmailTemplateData = {
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
};

function unwrapStrapiEntity<T>(entity: StrapiEntity<T> | null | undefined) {
  if (!entity) {
    return null;
  }

  return (entity.attributes ?? entity) as T;
}

async function fetchQuest(
  cmsUrl: string,
  questDocumentId: string,
  strapiApiToken: string
) {
  const res = await fetch(`${cmsUrl}/api/quests/${questDocumentId}`, {
    headers: {
      Authorization: `Bearer ${strapiApiToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch quest: ${res.status}`);
  }

  const json = await res.json();
  return unwrapStrapiEntity<QuestData>(json?.data);
}

async function fetchPurchaseEmailTemplate(
  cmsUrl: string,
  strapiApiToken: string
) {
  const res = await fetch(`${cmsUrl}/api/purchase-email-template`, {
    headers: {
      Authorization: `Bearer ${strapiApiToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch purchase email template: ${res.status}`);
  }

  const json = await res.json();
  return unwrapStrapiEntity<PurchaseEmailTemplateData>(json?.data);
}

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
    const strapiApiToken = process.env.STRAPI_API_TOKEN;

    if (!strapiApiToken) {
      console.error("Missing STRAPI_API_TOKEN");
      return NextResponse.json(
        { error: "Missing STRAPI_API_TOKEN" },
        { status: 500 }
      );
    }

    const existingRes = await fetch(
      `${cmsUrl}/api/quest-purchases?filters[stripeSessionId][$eq]=${stripeSessionId}`,
      {
        headers: {
          Authorization: `Bearer ${strapiApiToken}`,
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
        Authorization: `Bearer ${strapiApiToken}`,
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

    try {
      const [quest, emailTemplate] = await Promise.all([
        fetchQuest(cmsUrl, questDocumentId, strapiApiToken),
        fetchPurchaseEmailTemplate(cmsUrl, strapiApiToken),
      ]);

      if (!quest) {
        throw new Error("Quest not found for purchase email");
      }

      if (!emailTemplate) {
        throw new Error("Purchase email template not found");
      }

      const redeemBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const redeemUrl = `${redeemBaseUrl}/redeem?code=${encodeURIComponent(
        redemptionCode
      )}`;

      const variables = {
        questTitle: quest.title,
        redemptionCode,
        redeemUrl,
      };

      await sendQuestPurchaseEmail({
        to: buyerEmail,
        subject: renderTemplate(emailTemplate.subjectTemplate, variables),
        html: renderTemplate(emailTemplate.htmlTemplate, variables),
        text: renderTemplate(emailTemplate.textTemplate, variables),
      });
    } catch (error) {
      console.error("Failed to send purchase email", {
        stripeSessionId,
        buyerEmail,
        questDocumentId,
        error,
      });
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
