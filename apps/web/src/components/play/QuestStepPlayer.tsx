"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentPositionOnce } from "@/lib/geo/getCurrentPosition";
import { getDictionary } from "@/lib/i18n";
import {
  clearQuestDraft,
  loadQuestDraft,
  saveQuestDraft,
} from "@/lib/offline/questDrafts";

type QuestStepPlayerProps = {
  questAccessId: string;
  questTitle: string;
  warningMessage?: string;
  restartCurrentStep: boolean;
  version: number;
  step: {
    documentId: string;
    order: number;
    title: string;
    puzzleType: string;
    puzzleDataPublic?: {
      prompt?: string;
      hint?: string;
      [key: string]: unknown;
    };
  };
};

type SubmissionResult = {
  ok?: boolean;
  unlocked?: boolean;
  questCompleted?: boolean;
  nextStepDocumentId?: string | null;
  error?: string;
  checks?: {
    locationOk: boolean;
    answerOk: boolean;
    distanceMeters: number;
    radiusMeters: number;
    effectiveRadiusMeters: number;
  };
};

export default function QuestStepPlayer({
  questAccessId,
  questTitle,
  restartCurrentStep,
  step,
  version,
  warningMessage,
}: QuestStepPlayerProps) {
  const t = getDictionary();
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const prompt = String(step.puzzleDataPublic?.prompt ?? "");
  const hint = String(step.puzzleDataPublic?.hint ?? "");
  const draftKey = useMemo(
    () => ({
      questAccessId,
      stepDocumentId: step.documentId,
    }),
    [questAccessId, step.documentId]
  );

  useEffect(() => {
    if (restartCurrentStep) {
      clearQuestDraft(draftKey.questAccessId, draftKey.stepDocumentId);
    }

    const draft = loadQuestDraft(draftKey.questAccessId, draftKey.stepDocumentId);
    setAnswer(draft?.answer ?? "");
    setHydrated(true);
  }, [draftKey.questAccessId, draftKey.stepDocumentId, restartCurrentStep]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (answer.trim()) {
      saveQuestDraft(draftKey.questAccessId, draftKey.stepDocumentId, answer);
      return;
    }

    clearQuestDraft(draftKey.questAccessId, draftKey.stepDocumentId);
  }, [answer, draftKey.questAccessId, draftKey.stepDocumentId, hydrated]);

  async function handleSubmit() {
    setLoading(true);
    setRedirecting(false);
    setError(null);
    setStatus(t.step.checkingLocation);
    let shouldKeepBusy = false;

    try {
      const coords = await getCurrentPositionOnce();
      setStatus(t.step.validatingStep);

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questAccessId,
          stepDocumentId: step.documentId,
          answer,
          version,
          coords: {
            lat: coords.lat,
            lng: coords.lng,
            accuracy: coords.accuracy,
          },
          submittedAt: Date.now(),
        }),
      });

      const data = (await response.json()) as SubmissionResult;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? t.step.genericError);
      }

      if (!data.unlocked) {
        const parts: string[] = [];

        if (!data.checks?.locationOk) {
          parts.push(t.step.tooFar);
        }

        if (!data.checks?.answerOk) {
          parts.push(t.step.wrongAnswer);
        }

        setStatus(parts.join(" ") || t.step.notUnlocked);
        return;
      }

      clearQuestDraft(draftKey.questAccessId, draftKey.stepDocumentId);
      setRedirecting(true);
      shouldKeepBusy = true;
      setStatus(t.step.progressing);

      if (data.questCompleted) {
        router.push(`/play/${questAccessId}?completed=1&v=${Date.now()}`);
      } else {
        router.push(`/play/${questAccessId}/step?v=${Date.now()}`);
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : t.step.genericError;
      setError(message);
      setStatus(null);
    } finally {
      if (!shouldKeepBusy) {
        setLoading(false);
      }
    }
  }

  return (
    <section className="relative space-y-6 rounded-lg border border-border bg-card p-6">
      {loading || redirecting ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium shadow-sm">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            {status ?? t.step.validating}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{questTitle}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.step.titlePrefix} {step.order}
          {step.title ? ` \u00b7 ${step.title}` : ""}
        </h1>
      </div>

      {warningMessage ? (
        <div className="rounded-md border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          {warningMessage}
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-base text-card-foreground">
          {prompt || t.step.defaultPrompt}
        </p>

        {hint ? (
          <p className="text-sm text-muted-foreground">
            {t.step.hintLabel} : {hint}
          </p>
        ) : null}

      </div>

      <div className="space-y-2">
        <label htmlFor="quest-answer" className="text-sm font-medium">
          {t.step.answerLabel}
        </label>
        <input
          id="quest-answer"
          type="text"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder={t.step.answerPlaceholder}
          className="w-full rounded-md border border-border bg-background px-4 py-3 text-foreground"
          autoComplete="off"
          autoCapitalize="characters"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={
            loading ||
            redirecting ||
            step.puzzleType !== "text" ||
            !answer.trim()
          }
          onClick={handleSubmit}
          className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t.step.validateButton}
        </button>
      </div>

      {step.puzzleType !== "text" ? (
        <p className="text-sm text-destructive">{t.step.unsupportedPuzzle}</p>
      ) : null}

      {status && !loading && !redirecting ? (
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
