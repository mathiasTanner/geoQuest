import { Resend } from "resend";

type SendQuestPurchaseEmailInput = {
  to: string;
  questTitle: string;
  redemptionCode: string;
  redeemUrl: string;
};

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendQuestPurchaseEmail({
  to,
  questTitle,
  redemptionCode,
  redeemUrl,
}: SendQuestPurchaseEmailInput) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error("Missing EMAIL_FROM");
  }

  const subject = `Votre code GeoQuest — ${questTitle}`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h1 style="font-size: 20px; margin-bottom: 16px;">Paiement confirmé</h1>
      <p>Merci pour votre achat.</p>
      <p>Voici votre code de déblocage pour <strong>${questTitle}</strong> :</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${redemptionCode}</p>
      <p>
        Vous pouvez débloquer votre quête ici :
        <a href="${redeemUrl}">${redeemUrl}</a>
      </p>
      <p>Conservez cet email pour retrouver votre code plus tard.</p>
    </div>
  `;

  const text = [
    "Paiement confirmé",
    "",
    "Merci pour votre achat.",
    `Voici votre code de déblocage pour ${questTitle} :`,
    redemptionCode,
    "",
    `Débloquez votre quête ici : ${redeemUrl}`,
    "",
    "Conservez cet email pour retrouver votre code plus tard.",
  ].join("\n");

  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  return result;
}