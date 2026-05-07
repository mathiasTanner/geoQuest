import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  ensureQuestPurchaseForCheckout,
  getCmsUrl,
  getStrapiApiToken,
} from "@/lib/purchases/questPurchaseWorkflow";
import {
  CHECKOUT_STATE_COOKIE_NAME,
  clearCheckoutStateCookie,
} from "@/lib/purchases/checkoutState";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  const checkoutState = (await cookies()).get(CHECKOUT_STATE_COOKIE_NAME)?.value;

  if (!sessionId || !checkoutState) {
    return NextResponse.json({ status: "missing_session" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.status !== "complete" || session.payment_status !== "paid") {
      return NextResponse.json({ status: "processing" });
    }

    const questDocumentId = session.metadata?.questDocumentId;
    const sessionCheckoutState = session.metadata?.checkoutState;
    const buyerEmail =
      session.customer_details?.email ?? session.customer_email;

    if (sessionCheckoutState !== checkoutState) {
      return NextResponse.json(
        {
          status: "forbidden",
          message: "Cette session de paiement n'est pas disponible sur cet appareil.",
        },
        { status: 403 }
      );
    }

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

    const response = NextResponse.json({
      status: "confirmed",
      redemptionCode: ensuredPurchase.redemptionCode,
    });
    clearCheckoutStateCookie(response);
    return response;
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
