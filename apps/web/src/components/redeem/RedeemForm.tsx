"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getDictionary } from "@/lib/i18n";

type RedeemResult = {
  success?: boolean;
  recovered?: boolean;
  questAccessId?: string;
  restartCurrentStep?: boolean;
  warningMessage?: string;
  resumeHref?: string;
  quest?: {
    title: string;
    slug: string;
  } | null;
  error?: string;
};

type RedeemFormProps = {
  initialCode?: string;
};

export default function RedeemForm({ initialCode = "" }: RedeemFormProps) {
  const t = getDictionary();
  const router = useRouter();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setRedirecting(false);
    setResult(null);
    let didRedirect = false;

    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      const data = (await res.json()) as RedeemResult;

      if (!res.ok) {
        setResult({ error: data.error ?? t.redeem.invalidCode });
        return;
      }

      if (data.resumeHref) {
        didRedirect = true;
        setRedirecting(true);
        router.replace(data.resumeHref);
        return;
      }

      setResult(data);
    } catch {
      setResult({ error: t.redeem.invalidCode });
    } finally {
      if (!didRedirect) {
        setLoading(false);
      }
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-6 flex max-w-md flex-col gap-4">
        <input
          type="text"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t.redeem.inputPlaceholder}
          className="rounded-md border border-border bg-card px-4 py-2 text-card-foreground"
        />

        <button
          type="submit"
          disabled={loading || redirecting}
          className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          <span className="inline-flex items-center gap-2">
            {loading || redirecting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            {redirecting
              ? t.redeem.redirecting
              : loading
                ? t.redeem.loading
                : t.redeem.submit}
          </span>
        </button>
      </form>

      {result?.error ? (
        <p className="mt-4 text-sm text-destructive">{result.error}</p>
      ) : null}

      {result?.success && result.quest ? (
        <div className="mt-4 rounded-md border border-border bg-card p-4">
          <p className="font-medium">
            {t.redeem.success} : {result.quest.title}
          </p>
          {result.warningMessage ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {result.warningMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
