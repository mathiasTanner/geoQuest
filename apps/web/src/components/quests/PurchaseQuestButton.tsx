"use client";

import { useState } from "react";

type PurchaseQuestButtonProps = {
  questSlug: string;
  price: number;
};

export default function PurchaseQuestButton({
  questSlug,
  price,
}: PurchaseQuestButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questSlug,
        }),
      });

      if (!res.ok) {
        throw new Error(`Checkout failed with status ${res.status}`);
      }

      const data = (await res.json()) as { url?: string };

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("Missing checkout URL");
    } catch (error) {
      console.error(error);
      alert("Impossible de démarrer le paiement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Redirection..." : `Acheter cette quête — CHF ${price}`}
    </button>
  );
}
