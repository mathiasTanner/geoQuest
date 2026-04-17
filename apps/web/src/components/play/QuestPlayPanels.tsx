"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDictionary } from "@/lib/i18n";
import { clearQuestDraftsForQuestAccess } from "@/lib/offline/questDrafts";

type QuestPlayPanelsProps = {
  questAccessId: string;
  questSlug: string;
  isCompleted: boolean;
  completedStepsCount: number;
  warningMessage?: string;
  totalDuration?: string | null;
  primaryHref: string;
  primaryLabel: string;
};

export default function QuestPlayPanels({
  questAccessId,
  questSlug,
  isCompleted,
  completedStepsCount,
  warningMessage,
  totalDuration,
  primaryHref,
  primaryLabel,
}: QuestPlayPanelsProps) {
  const t = getDictionary();
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<"play" | "forget" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleForget() {
    setBusyAction("forget");
    setError(null);
    setShareStatus(null);
    setConfirmOpen(false);

    try {
      const response = await fetch("/api/me/quests/forget-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ questAccessId }),
        credentials: "same-origin",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? t.forgetDevice.genericError);
      }

      clearQuestDraftsForQuestAccess(questAccessId);
      router.replace("/redeem");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : t.forgetDevice.genericError;
      setError(message);
      setBusyAction(null);
    }
  }

  function handlePlay() {
    setError(null);
    setShareStatus(null);
    setBusyAction("play");
    router.push(primaryHref);
  }

  async function handleShare() {
    setBusyAction("share");
    setError(null);
    setShareStatus(null);

    const shareUrl = `${window.location.origin}/quests/${questSlug}`;
    const shareData = {
      title: "GeoQuest",
      text: `${t.play.completedTitle} ${shareUrl}`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus(t.play.shareSuccess);
        return;
      }

      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          shareUrl
        )}`,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (caughtError) {
      if (
        caughtError instanceof DOMException &&
        caughtError.name === "AbortError"
      ) {
        setShareStatus(null);
        return;
      }

      setError(t.play.shareError);
    } finally {
      setBusyAction(null);
    }
  }

  const isBusy = busyAction !== null;

  return (
    <>
      <div className="relative">
        {(busyAction === "play" || busyAction === "forget") ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium shadow-sm">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              {busyAction === "forget"
                ? t.forgetDevice.loading
                : t.play.launching}
            </div>
          </div>
        ) : null}

        <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="min-h-[260px] overflow-hidden rounded-lg border border-border bg-card p-6">
            <div className="space-y-4">
            {isCompleted ? (
              <>
                <h2 className="text-xl font-semibold">{t.play.completedTitle}</h2>
                <p className="text-muted-foreground">{t.play.completedBody}</p>
                {totalDuration ? (
                  <div className="rounded-md border border-border bg-background p-4">
                    <p className="text-sm text-muted-foreground">
                      {t.play.completedDurationLabel}
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{totalDuration}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold">{t.play.resumeTitle}</h2>
                <p className="text-muted-foreground">{t.play.resumeBody}</p>
                <p className="text-sm text-muted-foreground">
                  {t.play.completedStepsLabel} : {completedStepsCount}
                </p>
                {warningMessage ? (
                  <div className="rounded-md border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                    {warningMessage}
                  </div>
                ) : null}
              </>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePlay}
                disabled={isBusy}
                className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {primaryLabel}
              </button>

              {isCompleted ? (
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={isBusy}
                  className="inline-flex rounded-md border border-border bg-card px-4 py-2 text-card-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === "share" ? t.redeem.loading : t.play.shareCta}
                </button>
              ) : null}
            </div>

            {shareStatus ? (
              <p className="text-sm text-muted-foreground">{shareStatus}</p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          </div>

          <aside className="min-h-[260px] overflow-hidden rounded-lg border border-border bg-card p-6">
            <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t.play.deviceTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.play.deviceBody}</p>
            <p className="text-sm text-muted-foreground">
              {t.play.deviceRecoveryBody}
            </p>

            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={isBusy}
              className="inline-flex rounded-md border border-border bg-card px-4 py-2 text-card-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t.forgetDevice.button}
            </button>
          </div>
          </aside>
        </div>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">{t.forgetDevice.modalTitle}</h3>
              <p className="text-sm text-muted-foreground">
                {t.forgetDevice.modalBody}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="inline-flex rounded-md border border-border bg-card px-4 py-2 text-card-foreground transition hover:bg-muted"
              >
                {t.forgetDevice.cancel}
              </button>
              <button
                type="button"
                onClick={handleForget}
                className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground transition hover:bg-[var(--color-primary-hover)]"
              >
                {t.forgetDevice.confirmButton}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
