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

type QuestPurchaseData = {
  buyerEmail?: string;
  documentId?: string;
  emailStatus?: "pending" | "sent" | "failed";
  id?: number;
  redemptionCode?: string;
};

function maskEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  const visibleLocal = localPart.slice(0, 2);

  return `${visibleLocal}***@${domain || "unknown"}`;
}

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

async function fetchExistingPurchase(
  cmsUrl: string,
  stripeSessionId: string,
  strapiApiToken: string
) {
  const res = await fetch(
    `${cmsUrl}/api/quest-purchases?filters[stripeSessionId][$eq]=${stripeSessionId}`,
    {
      headers: {
        Authorization: `Bearer ${strapiApiToken}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to check existing Quest Purchase: ${res.status}`);
  }

  const json = await res.json();
  return json?.data?.[0] ?? null;
}

async function createQuestPurchase(
  cmsUrl: string,
  questDocumentId: string,
  stripeSessionId: string,
  buyerEmail: string,
  strapiApiToken: string
) {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
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
          emailStatus: "pending",
        },
      }),
    });

    if (createRes.ok) {
      const createdPurchaseJson = await createRes.json();
      return {
        purchase: createdPurchaseJson?.data as
          | StrapiEntity<QuestPurchaseData>
          | undefined,
        redemptionCode,
      };
    }

    const errorText = await createRes.text();
    const isRedemptionCollision =
      errorText.includes("redemptionCode") &&
      errorText.toLowerCase().includes("unique");

    if (isRedemptionCollision && attempt < maxAttempts - 1) {
      continue;
    }

    return {
      errorText,
      purchase: undefined,
      redemptionCode,
    };
  }

  return {
    errorText: "Failed to generate a unique redemption code",
    purchase: undefined,
    redemptionCode: undefined,
  };
}

async function updateQuestPurchase(
  cmsUrl: string,
  purchase: StrapiEntity<QuestPurchaseData>,
  strapiApiToken: string,
  data: Record<string, string | null>
) {
  const purchaseId = purchase.documentId ?? purchase.id;

  if (!purchaseId) {
    throw new Error("Missing purchase identifier for update");
  }

  const res = await fetch(`${cmsUrl}/api/quest-purchases/${purchaseId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${strapiApiToken}`,
    },
    body: JSON.stringify({ data }),
  });

  if (!res.ok) {
    throw new Error(`Failed to update Quest Purchase: ${res.status}`);
  }
}

async function sendPurchaseEmail({
  buyerEmail,
  cmsUrl,
  purchase,
  questDocumentId,
  redemptionCode,
  strapiApiToken,
}: {
  buyerEmail: string;
  cmsUrl: string;
  purchase?: StrapiEntity<QuestPurchaseData>;
  questDocumentId: string;
  redemptionCode: string;
  strapiApiToken: string;
}) {
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

    if (purchase) {
      await updateQuestPurchase(cmsUrl, purchase, strapiApiToken, {
        emailStatus: "sent",
        emailSentAt: new Date().toISOString(),
        emailFailureReason: null,
      });
    }
  } catch (error) {
    if (purchase) {
      try {
        await updateQuestPurchase(cmsUrl, purchase, strapiApiToken, {
          emailStatus: "failed",
          emailSentAt: null,
          emailFailureReason:
            error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
        });
      } catch (updateError) {
        console.error("Failed to update purchase email state", {
          stripeSessionId: purchase.documentId ?? purchase.id,
          updateError,
        });
      }
    }

    console.error("Failed to send purchase email", {
      questDocumentId,
      buyerEmail: maskEmail(buyerEmail),
      stripeSessionId: purchase?.documentId ?? purchase?.id,
      error,
    });
  }
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
        buyerEmail: buyerEmail ? maskEmail(buyerEmail) : undefined,
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

    let existingPurchase = null;

    try {
      existingPurchase = await fetchExistingPurchase(
        cmsUrl,
        stripeSessionId,
        strapiApiToken
      );
    } catch (error) {
      console.error("Failed to check existing Quest Purchase", error);
      return NextResponse.json(
        { error: "Failed to check existing purchase" },
        { status: 500 }
      );
    }

    if (existingPurchase) {
      const existingPurchaseData =
        unwrapStrapiEntity<QuestPurchaseData>(existingPurchase);
      const existingRedemptionCode = existingPurchaseData?.redemptionCode;
      const existingEmailStatus = existingPurchaseData?.emailStatus;
      const existingBuyerEmail = existingPurchaseData?.buyerEmail ?? buyerEmail;

      if (
        existingRedemptionCode &&
        existingEmailStatus !== "sent"
      ) {
        await sendPurchaseEmail({
          buyerEmail: existingBuyerEmail,
          cmsUrl,
          purchase: existingPurchase,
          questDocumentId,
          redemptionCode: existingRedemptionCode,
          strapiApiToken,
        });
      }

      return NextResponse.json({ received: true, duplicate: true });
    }

    const {
      errorText,
      purchase: createdPurchase,
      redemptionCode,
    } = await createQuestPurchase(
      cmsUrl,
      questDocumentId,
      stripeSessionId,
      buyerEmail,
      strapiApiToken
    );

    if (!createdPurchase) {

      try {
        existingPurchase = await fetchExistingPurchase(
          cmsUrl,
          stripeSessionId,
          strapiApiToken
        );
      } catch (error) {
        console.error("Failed to re-check Quest Purchase after create error", {
          stripeSessionId,
          error,
        });
      }

      if (existingPurchase) {
        const existingPurchaseData =
          unwrapStrapiEntity<QuestPurchaseData>(existingPurchase);
        const existingRedemptionCode = existingPurchaseData?.redemptionCode;
        const existingEmailStatus = existingPurchaseData?.emailStatus;
        const existingBuyerEmail = existingPurchaseData?.buyerEmail ?? buyerEmail;

        if (
          existingRedemptionCode &&
          existingEmailStatus !== "sent"
        ) {
          await sendPurchaseEmail({
            buyerEmail: existingBuyerEmail,
            cmsUrl,
            purchase: existingPurchase,
            questDocumentId,
            redemptionCode: existingRedemptionCode,
            strapiApiToken,
          });
        }

        return NextResponse.json({ received: true, duplicate: true });
      }

      console.error("Failed to create Quest Purchase", errorText);

      return NextResponse.json(
        { error: "Failed to create Quest Purchase" },
        { status: 500 }
      );
    }

    await sendPurchaseEmail({
      buyerEmail,
      cmsUrl,
      purchase: createdPurchase,
      questDocumentId,
      redemptionCode,
      strapiApiToken,
    });

    console.log("Quest Purchase created", {
      stripeSessionId,
      questDocumentId,
      buyerEmail: maskEmail(buyerEmail),
    });
  }

  return NextResponse.json({ received: true });
}
