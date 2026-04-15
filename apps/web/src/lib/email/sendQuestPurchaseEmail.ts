import { Resend } from "resend";

type SendQuestPurchaseEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const resend = new Resend(process.env.RESEND_API_KEY);

export function renderTemplate(
  template: string,
  variables: Record<string, string>
) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

export async function sendQuestPurchaseEmail({
  to,
  subject,
  html,
  text,
}: SendQuestPurchaseEmailInput) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error("Missing EMAIL_FROM");
  }

  return resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });
}
