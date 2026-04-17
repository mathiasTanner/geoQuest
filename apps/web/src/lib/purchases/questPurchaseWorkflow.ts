import {
  renderTemplate,
  sendQuestPurchaseEmail,
} from "@/lib/email/sendQuestPurchaseEmail";
import { generateRedemptionCode } from "@/lib/purchases/generateRedemptionCode";

export type StrapiEntity<T> = T & {
  attributes?: T;
  documentId?: string;
  id?: number;
};

export type QuestPurchaseEmailStatus = "pending" | "sent" | "failed";

type QuestData = {
  title: string;
};

type PurchaseEmailTemplateData = {
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
};

export type QuestPurchaseData = {
  buyerEmail?: string;
  documentId?: string;
  emailStatus?: QuestPurchaseEmailStatus;
  id?: number;
  redemptionCode?: string;
};

export function maskEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  const visibleLocal = localPart.slice(0, 2);

  return `${visibleLocal}***@${domain || "unknown"}`;
}

export function getCmsUrl() {
  const cmsUrl = process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL;

  if (!cmsUrl) {
    throw new Error("Missing CMS_URL / NEXT_PUBLIC_CMS_URL");
  }

  return cmsUrl;
}

export function getStrapiApiToken() {
  const token = process.env.STRAPI_API_TOKEN;

  if (!token) {
    throw new Error("Missing STRAPI_API_TOKEN");
  }

  return token;
}

export function unwrapStrapiEntity<T>(
  entity: StrapiEntity<T> | null | undefined
) {
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

export async function fetchExistingPurchase(
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
}): Promise<QuestPurchaseEmailStatus> {
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

    return "sent";
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

    return "failed";
  }
}

async function finalizeExistingPurchase({
  buyerEmail,
  cmsUrl,
  existingPurchase,
  questDocumentId,
  strapiApiToken,
}: {
  buyerEmail: string;
  cmsUrl: string;
  existingPurchase: StrapiEntity<QuestPurchaseData>;
  questDocumentId: string;
  strapiApiToken: string;
}) {
  const existingPurchaseData =
    unwrapStrapiEntity<QuestPurchaseData>(existingPurchase);
  const existingRedemptionCode = existingPurchaseData?.redemptionCode;
  const existingEmailStatus = existingPurchaseData?.emailStatus;
  const existingBuyerEmail = existingPurchaseData?.buyerEmail ?? buyerEmail;

  if (!existingRedemptionCode) {
    throw new Error("Existing purchase is missing redemption code");
  }

  const emailStatus =
    existingEmailStatus === "sent"
      ? "sent"
      : await sendPurchaseEmail({
          buyerEmail: existingBuyerEmail,
          cmsUrl,
          purchase: existingPurchase,
          questDocumentId,
          redemptionCode: existingRedemptionCode,
          strapiApiToken,
        });

  return {
    duplicate: true,
    emailStatus,
    purchase: existingPurchase,
    redemptionCode: existingRedemptionCode,
  };
}

export async function ensureQuestPurchaseForCheckout({
  buyerEmail,
  cmsUrl,
  questDocumentId,
  stripeSessionId,
  strapiApiToken,
}: {
  buyerEmail: string;
  cmsUrl: string;
  questDocumentId: string;
  stripeSessionId: string;
  strapiApiToken: string;
}) {
  let existingPurchase = await fetchExistingPurchase(
    cmsUrl,
    stripeSessionId,
    strapiApiToken
  );

  if (existingPurchase) {
    return finalizeExistingPurchase({
      buyerEmail,
      cmsUrl,
      existingPurchase,
      questDocumentId,
      strapiApiToken,
    });
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
    existingPurchase = await fetchExistingPurchase(
      cmsUrl,
      stripeSessionId,
      strapiApiToken
    );

    if (existingPurchase) {
      return finalizeExistingPurchase({
        buyerEmail,
        cmsUrl,
        existingPurchase,
        questDocumentId,
        strapiApiToken,
      });
    }

    throw new Error(errorText ?? "Failed to create Quest Purchase");
  }

  if (!redemptionCode) {
    throw new Error("Failed to create Quest Purchase redemption code");
  }

  const emailStatus = await sendPurchaseEmail({
    buyerEmail,
    cmsUrl,
    purchase: createdPurchase,
    questDocumentId,
    redemptionCode,
    strapiApiToken,
  });

  return {
    duplicate: false,
    emailStatus,
    purchase: createdPurchase,
    redemptionCode,
  };
}
