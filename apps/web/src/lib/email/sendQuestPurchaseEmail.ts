import { Resend } from "resend";

type SendQuestPurchaseEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  return new Resend(apiKey);
}

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
  if (!process.env.EMAIL_FROM) {
    throw new Error("Missing EMAIL_FROM");
  }

  const result = await getResendClient().emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  if (result.error) {
    throw new Error(
      typeof result.error.message === "string"
        ? result.error.message
        : "Resend email send failed"
    );
  }

  if (!result.data?.id) {
    throw new Error("Resend email send returned no message id");
  }

  return result;
}
