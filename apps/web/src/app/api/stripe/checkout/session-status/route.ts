import { NextRequest, NextResponse } from "next/server";
import {
  ensureQuestPurchaseForCheckout,
  getCmsUrl,
  getStrapiApiToken,
} from "@/lib/purchases/questPurchaseWorkflow";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ status: "missing_session" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.status !== "complete" || session.payment_status !== "paid") {
      return NextResponse.json({ status: "processing" });
    }

    const questDocumentId = session.metadata?.questDocumentId;
    const buyerEmail =
      session.customer_details?.email ?? session.customer_email;

    if (!questDocumentId || !buyerEmail) {
      return NextResponse.json(
        {
          status: "error",
          message: "Impossible de recuperer les informations de paiement.",
        },
        { status: 500 }
      );
    }

    const ensuredPurchase = await ensureQuestPurchaseForCheckout({
      buyerEmail,
      cmsUrl: getCmsUrl(),
      questDocumentId,
      stripeSessionId: sessionId,
      strapiApiToken: getStrapiApiToken(),
    });

    return NextResponse.json({
      status: "confirmed",
      redemptionCode: ensuredPurchase.redemptionCode,
    });
  } catch (error) {
    console.error("session-status route error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: "Impossible de finaliser votre code pour le moment.",
      },
      { status: 500 }
    );
  }
}
