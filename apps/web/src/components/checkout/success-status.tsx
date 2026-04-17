"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n";

type Props = {
  sessionId: string;
};

type SessionStatusResponse =
  | {
      status: "processing";
    }
  | {
      status: "confirmed";
      redemptionCode: string;
      questTitle?: string;
    }
  | {
      status: "missing_session";
    }
  | {
      status: "error";
      message?: string;
    };

export function SuccessStatus({ sessionId }: Props) {
  const dict = getDictionary();
  const [data, setData] = useState<SessionStatusResponse | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    let attempts = 0;
    let isCancelled = false;
    const maxAttempts = 20;

    const pollStatus = async () => {
      while (!isCancelled && attempts < maxAttempts) {
        attempts += 1;

        try {
          const res = await fetch(
            `/api/stripe/checkout/session-status?session_id=${encodeURIComponent(sessionId)}`,
            {
              cache: "no-store",
            }
          );

          const text = await res.text();

          try {
            const json = JSON.parse(text) as SessionStatusResponse;

            if (isCancelled) {
              return;
            }

            setData(json);

            if (json.status === "confirmed" || json.status === "error") {
              return;
            }
          } catch {
            console.error("Non-JSON response from session-status API:", text);

            if (!isCancelled) {
              setData({
                status: "error",
                message: dict.checkoutSuccess.invalidApiResponse,
              });
            }

            return;
          }
        } catch (error) {
          console.error("Failed to fetch session status:", error);

          if (!isCancelled) {
            setData({
              status: "error",
              message: dict.checkoutSuccess.fetchError,
            });
          }

          return;
        }

        if (attempts >= maxAttempts) {
          if (!isCancelled) {
            setHasTimedOut(true);
          }
          return;
        }

        await new Promise((resolve) => {
          window.setTimeout(resolve, 2000);
        });
      }
    };

    void pollStatus();

    return () => {
      isCancelled = true;
    };
  }, [
    sessionId,
    dict.checkoutSuccess.fetchError,
    dict.checkoutSuccess.invalidApiResponse,
  ]);

  if (!data || data.status === "processing") {
    return (
      <div className="mt-6">
        <p className="text-sm text-muted-foreground">
          {hasTimedOut
            ? dict.checkoutSuccess.processingDelay
            : dict.checkoutSuccess.loading}
        </p>
      </div>
    );
  }

  if (data.status === "confirmed") {
    return (
      <div className="mt-6 space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {dict.checkoutSuccess.codeLabel}
          </p>
          <p className="mt-2 font-mono text-lg font-semibold">
            {data.redemptionCode}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {dict.checkoutSuccess.codeVisibleNotice}
          </p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">
            {dict.checkoutSuccess.referenceLabel}
          </p>
          <p className="mt-2 break-all text-sm font-medium">{sessionId}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {dict.checkoutSuccess.supportHint}
          </p>
        </div>

        <div>
          <Link
            href={`/redeem?code=${encodeURIComponent(data.redemptionCode)}`}
            className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-[var(--color-primary-hover)]"
          >
            {dict.checkoutSuccess.redeemCta}
          </Link>
        </div>
      </div>
    );
  }

  if (data.status === "error") {
    return (
      <p className="mt-6 text-sm text-red-600">
        {data.message ?? dict.checkoutSuccess.genericError}
      </p>
    );
  }

  return null;
}
