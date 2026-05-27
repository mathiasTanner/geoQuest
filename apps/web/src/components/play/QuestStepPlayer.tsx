"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentPositionOnce } from "@/lib/geo/getCurrentPosition";
import { getDictionary } from "@/lib/i18n";
import {
  clearQuestDraft,
  loadQuestDraft,
  saveQuestDraft,
  type QuestDraft,
  type SudokuDraftMeta,
} from "@/lib/offline/questDrafts";
import {
  cloneSudokuGrid,
  isSudokuGridComplete,
  parsePublicPuzzleData,
  parsePuzzleSubmission,
  type ParsedPublicPuzzle,
  type PuzzleSubmission,
  type SudokuSubmission,
} from "@/lib/quests/puzzleTypes";
import HangmanPuzzle from "@/components/play/HangmanPuzzle";
import SudokuPuzzle from "@/components/play/SudokuPuzzle";
import TextPuzzle from "@/components/play/TextPuzzle";

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
    flavorText?: string;
    puzzleType: string;
    puzzleDataPublic?: Record<string, unknown>;
    successText?: string;
    updatedAt?: string;
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

type SudokuCompletionStats = {
  durationMs: number;
  checkCount: number;
  solveCount: number;
};

function buildDefaultSubmission(parsedPuzzle: ParsedPublicPuzzle): PuzzleSubmission {
  switch (parsedPuzzle.type) {
    case "text":
      return {
        type: "text",
        answer: "",
      };
    case "hangman":
      return {
        type: "hangman",
        guessedLetters: [],
      };
    case "sudoku":
      return {
        type: "sudoku",
        grid: cloneSudokuGrid(parsedPuzzle.data.initialGrid),
      };
  }
}

function draftToSubmission(
  parsedPuzzle: ParsedPublicPuzzle,
  draft: QuestDraft | null
): PuzzleSubmission {
  if (!draft || draft.type !== parsedPuzzle.type) {
    return buildDefaultSubmission(parsedPuzzle);
  }

  try {
    switch (draft.type) {
      case "text":
        return parsePuzzleSubmission(parsedPuzzle.type, {
          answer: draft.answer,
        });
      case "hangman":
        return parsePuzzleSubmission(parsedPuzzle.type, {
          guessedLetters: draft.guessedLetters,
        });
      case "sudoku":
        return parsePuzzleSubmission(parsedPuzzle.type, {
          grid: draft.grid,
        });
    }
  } catch {
    return buildDefaultSubmission(parsedPuzzle);
  }
}

function shouldPersistDraft(
  parsedPuzzle: ParsedPublicPuzzle,
  submission: PuzzleSubmission,
  sudokuDraftMeta?: SudokuDraftMeta | null
) {
  switch (parsedPuzzle.type) {
    case "text":
      return submission.type === "text" && submission.answer.trim().length > 0;
    case "hangman":
      return (
        submission.type === "hangman" && submission.guessedLetters.length > 0
      );
    case "sudoku":
      return (
        submission.type === "sudoku" &&
        (JSON.stringify(submission.grid) !==
          JSON.stringify(parsedPuzzle.data.initialGrid) ||
          Boolean(
            sudokuDraftMeta &&
              (sudokuDraftMeta.startedAt ||
                sudokuDraftMeta.checkCount ||
                sudokuDraftMeta.solveCount)
          ))
      );
  }
}

function defaultReadyState(parsedPuzzle: ParsedPublicPuzzle, submission: PuzzleSubmission) {
  switch (parsedPuzzle.type) {
    case "text":
      return submission.type === "text" && submission.answer.trim().length > 0;
    case "hangman":
      return false;
    case "sudoku":
      return submission.type === "sudoku" && isSudokuGridComplete(submission.grid);
  }
}

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
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submission, setSubmission] = useState<PuzzleSubmission | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [draftPersistenceDisabled, setDraftPersistenceDisabled] = useState(false);
  const [sudokuDraftMeta, setSudokuDraftMeta] = useState<SudokuDraftMeta | null>(
    null
  );
  const [successState, setSuccessState] = useState<{
    questCompleted: boolean;
    sudokuStats?: SudokuCompletionStats;
  } | null>(null);

  const parsedPuzzleResult = useMemo(() => {
    try {
      return {
        parsed: parsePublicPuzzleData(step.puzzleType, step.puzzleDataPublic ?? {}),
        error: null,
      };
    } catch (caughtError) {
      return {
        parsed: null,
        error:
          caughtError instanceof Error
            ? caughtError.message
            : t.step.unsupportedPuzzle,
      };
    }
  }, [step.puzzleDataPublic, step.puzzleType, t.step.unsupportedPuzzle]);
  const parsedPuzzle = parsedPuzzleResult.parsed;
  const prompt = parsedPuzzle?.data.prompt ?? "";
  const hint = parsedPuzzle?.data.hint ?? "";
  const flavorText = step.flavorText?.trim() ?? "";
  const successText = step.successText?.trim() ?? "";
  const draftKey = useMemo(
    () => ({
      questAccessId,
      stepDocumentId: step.documentId,
      stepRevision: step.updatedAt ?? "",
    }),
    [questAccessId, step.documentId, step.updatedAt]
  );

  useEffect(() => {
    if (!parsedPuzzle) {
      setSubmission(null);
      setCanSubmit(false);
      setHydrated(true);
      return;
    }

    if (restartCurrentStep) {
      clearQuestDraft(draftKey.questAccessId, draftKey.stepDocumentId);
    }

    const draft = restartCurrentStep
      ? null
      : loadQuestDraft(
          draftKey.questAccessId,
          draftKey.stepDocumentId,
          draftKey.stepRevision
        );
    const nextSubmission = draftToSubmission(parsedPuzzle, draft);

    setSubmission(nextSubmission);
    setCanSubmit(defaultReadyState(parsedPuzzle, nextSubmission));
    setDraftPersistenceDisabled(false);
    setSudokuDraftMeta(
      draft?.type === "sudoku"
        ? {
            startedAt: draft.startedAt,
            checkCount: draft.checkCount,
            solveCount: draft.solveCount,
          }
        : null
    );
    setHydrated(true);
  }, [
    draftKey.questAccessId,
    draftKey.stepDocumentId,
    draftKey.stepRevision,
    parsedPuzzle,
    restartCurrentStep,
  ]);

  useEffect(() => {
    if (!hydrated || !parsedPuzzle || !submission || draftPersistenceDisabled) {
      return;
    }

    if (shouldPersistDraft(parsedPuzzle, submission)) {
      saveQuestDraft(
        draftKey.questAccessId,
        draftKey.stepDocumentId,
        draftKey.stepRevision,
        submission,
        submission.type === "sudoku" ? sudokuDraftMeta ?? undefined : undefined
      );
      return;
    }

    clearQuestDraft(draftKey.questAccessId, draftKey.stepDocumentId);
  }, [
    draftKey.questAccessId,
    draftKey.stepDocumentId,
    draftKey.stepRevision,
    draftPersistenceDisabled,
    hydrated,
    parsedPuzzle,
    submission,
    sudokuDraftMeta,
  ]);

  async function handleSubmit(options?: {
    submissionOverride?: PuzzleSubmission;
    skipSuccessState?: boolean;
    sudokuStats?: SudokuCompletionStats;
  }) {
    const activeSubmission = options?.submissionOverride ?? submission;

    if (!activeSubmission) {
      return null;
    }

    setLoading(true);
    setSuccessState(null);
    setError(null);
    setStatus(t.step.checkingLocation);

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
          submission: activeSubmission,
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
          parts.push(
            parsedPuzzle?.type === "hangman"
              ? t.step.hangmanNotSolved
              : parsedPuzzle?.type === "sudoku"
                ? t.step.sudokuIncorrect
                : t.step.wrongAnswer
          );
        }

        setStatus(parts.join(" ") || t.step.notUnlocked);
        return data;
      }

      clearQuestDraft(draftKey.questAccessId, draftKey.stepDocumentId);
      setDraftPersistenceDisabled(true);
      setStatus(null);

      if (!options?.skipSuccessState) {
        setSuccessState({
          questCompleted: Boolean(data.questCompleted),
          sudokuStats: options?.sudokuStats,
        });
      }

      return data;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : t.step.genericError;
      setError(message);
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  function handleResetStep() {
    if (!parsedPuzzle) {
      return;
    }

    const nextSubmission = buildDefaultSubmission(parsedPuzzle);
    clearQuestDraft(draftKey.questAccessId, draftKey.stepDocumentId);
    setDraftPersistenceDisabled(false);
    setSubmission(nextSubmission);
    setCanSubmit(defaultReadyState(parsedPuzzle, nextSubmission));
    setSudokuDraftMeta(null);
    setSuccessState(null);
    setStatus(null);
    setError(null);
  }

  function handleContinueAfterSuccess() {
    if (!successState) {
      return;
    }

    if (successState.questCompleted) {
      router.push(`/play/${questAccessId}?completed=1&v=${Date.now()}`);
      return;
    }

    router.push(`/play/${questAccessId}/step?v=${Date.now()}`);
  }

  async function handleSudokuSolve(
    nextSubmission: SudokuSubmission,
    stats: SudokuCompletionStats
  ) {
    setSubmission(nextSubmission);
    setCanSubmit(isSudokuGridComplete(nextSubmission.grid));

    const result = await handleSubmit({
      submissionOverride: nextSubmission,
      skipSuccessState: true,
      sudokuStats: stats,
    });

    if (!result?.ok || !result.unlocked) {
      return null;
    }

    clearQuestDraft(draftKey.questAccessId, draftKey.stepDocumentId);
    return {
      questCompleted: Boolean(result.questCompleted),
      stats,
    };
  }

  function handleContinueAfterSudoku(questCompleted: boolean) {
    if (questCompleted) {
      router.push(`/play/${questAccessId}?completed=1&v=${Date.now()}`);
      return;
    }

    router.push(`/play/${questAccessId}/step?v=${Date.now()}`);
  }

  function renderPuzzle() {
    if (!parsedPuzzle || !submission) {
      return (
        <p className="text-sm text-destructive">
          {parsedPuzzleResult.error ?? t.step.unsupportedPuzzle}
        </p>
      );
    }

    switch (parsedPuzzle.type) {
      case "text":
        if (submission.type !== "text") {
          return null;
        }

        return (
          <TextPuzzle
            value={submission}
            onChange={(next) => {
              setSubmission(next);
              setCanSubmit(next.answer.trim().length > 0);
            }}
          />
        );
      case "hangman":
        if (submission.type !== "hangman") {
          return null;
        }

        return (
          <HangmanPuzzle
            questAccessId={questAccessId}
            stepDocumentId={step.documentId}
            publicData={parsedPuzzle.data}
            value={submission}
            onChange={setSubmission}
            onReadyChange={setCanSubmit}
          />
        );
      case "sudoku":
        if (submission.type !== "sudoku") {
          return null;
        }

        return (
          <SudokuPuzzle
            questAccessId={questAccessId}
            stepDocumentId={step.documentId}
            publicData={parsedPuzzle.data}
            value={submission}
            onChange={(next) => {
              setSubmission(next);
              setCanSubmit(isSudokuGridComplete(next.grid));
            }}
            onReadyChange={setCanSubmit}
            initialMeta={sudokuDraftMeta}
            successText={successText}
            title={step.title || `${t.step.titlePrefix} ${step.order}`}
            onDraftMetaChange={setSudokuDraftMeta}
            onRequestSolve={handleSudokuSolve}
            onContinueAfterComplete={handleContinueAfterSudoku}
          />
        );
    }
  }

  return (
    <section className="relative space-y-6 rounded-lg border border-border bg-card p-6">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium shadow-sm">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            {status ?? t.step.validating}
          </div>
        </div>
      ) : null}

      {successState && parsedPuzzle?.type !== "sudoku" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-background/90 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl space-y-4 rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {t.step.successTitle}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                {step.title || `${t.step.titlePrefix} ${step.order}`}
              </h2>
            </div>

            <div className="space-y-3">
              <p className="whitespace-pre-line text-base text-card-foreground">
                {successText ||
                  (successState.questCompleted
                    ? t.step.successCompletedBody
                    : t.step.successDefaultBody)}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleContinueAfterSuccess}
                className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-[var(--color-primary-hover)]"
              >
                {successState.questCompleted
                  ? t.step.successQuestComplete
                  : t.step.successContinue}
              </button>
            </div>
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

        {flavorText ? (
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              {t.step.flavorTextLabel}
            </p>
            <p className="whitespace-pre-line text-base text-card-foreground">
              {flavorText}
            </p>
          </div>
        ) : null}
      </div>

      {renderPuzzle()}

      {parsedPuzzle?.type !== "sudoku" ? (
        <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading || !canSubmit}
              onClick={() => {
                void handleSubmit();
              }}
              className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t.step.validateButton}
            </button>
          {parsedPuzzle && submission ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleResetStep}
              className="inline-flex rounded-md border border-border bg-background px-4 py-2 text-foreground hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t.step.resetStep}
            </button>
          ) : null}
        </div>
      ) : null}

      {status && !loading ? (
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
