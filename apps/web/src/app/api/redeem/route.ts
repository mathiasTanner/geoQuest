import { NextResponse } from "next/server";
import { getCmsUrl } from "@/lib/purchases/questPurchaseWorkflow";

export async function POST(req: Request) {
  const body = await req.json();
  const code = String(body?.code ?? "").trim().toUpperCase();

  if (!code) {
    return NextResponse.json(
      { error: "Missing code" },
      { status: 400 }
    );
  }

  const cmsUrl = getCmsUrl();

  const res = await fetch(
    `${cmsUrl}/api/quest-purchases?filters[redemptionCode][$eq]=${code}&populate[quest]=true`,
    {
        headers: {
        Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
    }
    );

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Failed to fetch Quest Purchase", errorText);

    return NextResponse.json(
      { error: "Failed to fetch purchase" },
      { status: 500 }
    );
  }

  const json = await res.json();
  const purchaseEntry = json?.data?.[0];
  const purchase = purchaseEntry?.attributes ?? purchaseEntry;

  if (!purchaseEntry || !purchase) {
    return NextResponse.json(
      { error: "Invalid code" },
      { status: 404 }
    );
  }

  if (purchase.purchaseStatus === "redeemed") {
    return NextResponse.json(
      { error: "Code already redeemed" },
      { status: 400 }
    );
  }

  const quest = purchase.quest?.data?.attributes ?? purchase.quest;

  const updateRes = await fetch(
    `${cmsUrl}/api/quest-purchases/${purchaseEntry.documentId ?? purchaseEntry.id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
      },
      body: JSON.stringify({
        data: {
          purchaseStatus: "redeemed",
          redeemedAt: new Date().toISOString(),
        },
      }),
    }
  );

  if (!updateRes.ok) {
    const errorText = await updateRes.text();
    console.error("Failed to update Quest Purchase", errorText);

    return NextResponse.json(
      { error: "Failed to redeem code" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    quest: quest
      ? {
          title: quest.title,
          slug: quest.slug,
        }
      : null,
  });
}
