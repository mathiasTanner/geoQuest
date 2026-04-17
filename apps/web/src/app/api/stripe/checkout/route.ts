import { NextResponse } from "next/server";
import { getCmsUrl } from "@/lib/purchases/questPurchaseWorkflow";
import { getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const body = await req.json();
  const { questSlug } = body;

  if (!questSlug) {
    return NextResponse.json(
      { error: "Missing questSlug" },
      { status: 400 }
    );
  }

  const cmsUrl = getCmsUrl();

  const res = await fetch(
    `${cmsUrl}/api/quests?filters[slug][$eq]=${questSlug}&populate=*`,
    {
      headers: {
        Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
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
    },
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/quests/${questSlug}`,
  });

  return NextResponse.json({ url: session.url });
}
