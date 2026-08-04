"use client";

import { useState } from "react";
import { getDictionary } from "@/lib/i18n";

type StepAssistancePanelProps = {
  busyAction: "hint" | "reveal" | null;
  canHint: boolean;
  canReveal: boolean;
  hintUses: number;
  maxSmallHints: number;
  stepPenaltySeconds: number;
  totalPenaltySeconds: number;
  hintPenaltySeconds: number;
  revealPenaltySeconds: number;
  onHint: () => void;
  onReveal: () => void;
};

function formatPenalty(seconds: number) {
  const safeSeconds = Math.max(Math.round(seconds), 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  if (minutes === 0) {
    return `+${safeSeconds}s`;
  }

  if (remainder === 0) {
    return `+${minutes} min`;
  }

  return `+${minutes} min ${remainder}s`;
}

export default function StepAssistancePanel({
  busyAction,
  canHint,
  canReveal,
  hintUses,
  maxSmallHints,
  stepPenaltySeconds,
  totalPenaltySeconds,
  hintPenaltySeconds,
  revealPenaltySeconds,
  onHint,
  onReveal,
}: StepAssistancePanelProps) {
  const t = getDictionary();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div className="rounded-2xl border border-border bg-background/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {t.step.assistTitle}
            </p>
            <p className="text-sm text-muted-foreground">
              {t.step.assistHintProgress
                .replace("{used}", String(hintUses))
                .replace("{total}", String(maxSmallHints))}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
            <div>
              <dt>{t.step.assistStepPenaltyLabel}</dt>
              <dd className="mt-1 font-semibold text-foreground">
                {formatPenalty(stepPenaltySeconds)}
              </dd>
            </div>
            <div>
              <dt>{t.step.assistQuestPenaltyLabel}</dt>
              <dd className="mt-1 font-semibold text-foreground">
                {formatPenalty(totalPenaltySeconds)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onHint}
            disabled={!canHint || busyAction !== null}
            className="rounded-2xl border border-amber-400/45 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-800 transition hover:border-amber-400/70 hover:bg-amber-500/16 dark:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === "hint"
              ? t.step.assistHintLoading
              : `${t.step.assistHintButton} (${formatPenalty(hintPenaltySeconds)})`}
          </button>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!canReveal || busyAction !== null}
            className="rounded-2xl bg-orange-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === "reveal"
              ? t.step.assistRevealLoading
              : `${t.step.assistRevealButton} (${formatPenalty(revealPenaltySeconds)})`}
          </button>
        </div>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">{t.step.assistRevealConfirmTitle}</h3>
              <p className="text-sm text-muted-foreground">
                {t.step.assistRevealConfirmBody.replace(
                  "{penalty}",
                  formatPenalty(revealPenaltySeconds)
                )}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="inline-flex rounded-md border border-border bg-card px-4 py-2 text-card-foreground transition hover:bg-muted"
              >
                {t.step.assistRevealCancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  onReveal();
                }}
                className="inline-flex rounded-md bg-orange-300 px-4 py-2 text-slate-950 transition hover:bg-orange-200"
              >
                {t.step.assistRevealConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
