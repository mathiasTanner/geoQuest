"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentPositionOnce } from "@/lib/geo/getCurrentPosition";
import { getDictionary } from "@/lib/i18n";
import {
  clearQuestDraft,
  loadQuestDraft,
  saveQuestDraft,
  type CrosswordDraftMeta,
  type QuestDraft,
  type SudokuDraftMeta,
  type WordsearchDraftMeta,
} from "@/lib/offline/questDrafts";
import {
  cloneSudokuGrid,
  getAlphabetSymbolsInOrder,
  isSudokuGridComplete,
  parsePublicPuzzleData,
  parsePuzzleSubmission,
  type AlphabetSubmission,
  type CrosswordSubmission,
  type ParsedPublicPuzzle,
  type PuzzleSubmission,
  type SudokuSubmission,
  type WordsearchSubmission,
} from "@/lib/quests/puzzleTypes";
import AlphabetPuzzle from "@/components/play/AlphabetPuzzle";
import CrosswordPuzzle from "@/components/play/CrosswordPuzzle";
import HangmanPuzzle from "@/components/play/HangmanPuzzle";
import StepAssistancePanel from "@/components/play/StepAssistancePanel";
import SudokuPuzzle from "@/components/play/SudokuPuzzle";
import TextPuzzle from "@/components/play/TextPuzzle";
import WordsearchPuzzle from "@/components/play/WordsearchPuzzle";
import type {
  StepAssistAction,
  StepAssistanceConfig,
  StepAssistanceSnapshot,
} from "@/lib/quests/stepAssistance";

type QuestStepPlayerProps = {
  questAccessId: string;
  questTitle: string;
  warningMessage?: string;
  restartCurrentStep: boolean;
  version: number;
  assistance: StepAssistanceSnapshot;
  assistanceConfig: StepAssistanceConfig;
  totalPenaltySeconds: number;
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
  version?: number;
  error?: string;
  checks?: {
    locationOk: boolean;
    answerOk: boolean;
    distanceMeters: number;
    radiusMeters: number;
    effectiveRadiusMeters: number;
  };
};

type AssistResponse = {
  ok?: boolean;
  action?: StepAssistAction;
  version?: number;
  stepAssistance?: StepAssistanceSnapshot;
  totalPenaltySeconds?: number;
  nextSubmission?: PuzzleSubmission;
  statusMessage?: string;
  error?: string;
};

type PuzzleCompletionStats = {
  durationMs: number;
  checkCount: number;
  solveCount: number;
};

type WordsearchCompletionStats = {
  durationMs: number;
  hintCountUsed: number;
  foundCount: number;
};

type CrosswordCompletionStats = {
  durationMs: number;
  hintCountUsed: number;
  filledClueCount: number;
};

type StatusTone = "info" | "hint" | "reveal";

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
    case "alphabet":
      return {
        type: "alphabet",
        assignments: {},
      };
    case "wordsearch":
      return {
        type: "wordsearch",
        foundWordIds: [],
      };
    case "crossword":
      return {
        type: "crossword",
        cells: {},
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
      case "alphabet":
        return parsePuzzleSubmission(parsedPuzzle.type, {
          assignments: draft.assignments,
        });
      case "wordsearch":
        return parsePuzzleSubmission(parsedPuzzle.type, {
          foundWordIds: draft.foundWordIds,
        });
      case "crossword":
        return parsePuzzleSubmission(parsedPuzzle.type, {
          cells: draft.cells,
        });
    }
  } catch {
    return buildDefaultSubmission(parsedPuzzle);
  }
}

function getStartingSubmission(
  parsedPuzzle: ParsedPublicPuzzle,
  draft: QuestDraft | null,
  assistance: StepAssistanceSnapshot
) {
  if (draft) {
    return draftToSubmission(parsedPuzzle, draft);
  }

  if (assistance.assistedSubmission) {
    try {
      return parsePuzzleSubmission(parsedPuzzle.type, assistance.assistedSubmission);
    } catch {
      return buildDefaultSubmission(parsedPuzzle);
    }
  }

  return buildDefaultSubmission(parsedPuzzle);
}

function shouldPersistDraft(
  parsedPuzzle: ParsedPublicPuzzle,
  submission: PuzzleSubmission,
  sudokuDraftMeta?: SudokuDraftMeta | null,
  wordsearchDraftMeta?: WordsearchDraftMeta | null,
  crosswordDraftMeta?: CrosswordDraftMeta | null
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
    case "alphabet":
      return (
        submission.type === "alphabet" &&
        Object.keys(submission.assignments).length > 0
      );
    case "wordsearch":
      return (
        submission.type === "wordsearch" &&
        (submission.foundWordIds.length > 0 ||
          Boolean(
            wordsearchDraftMeta &&
              (wordsearchDraftMeta.hintCountUsed ||
                wordsearchDraftMeta.activeHintWordId ||
                wordsearchDraftMeta.activeHintLevel ||
                wordsearchDraftMeta.activeHintStartCell ||
                wordsearchDraftMeta.activeHintDirection ||
                (wordsearchDraftMeta.activeHintCells?.length ?? 0) > 0 ||
                Object.keys(wordsearchDraftMeta.foundWordCellsById ?? {}).length > 0)
          ))
      );
    case "crossword":
      return (
        submission.type === "crossword" &&
        (Object.keys(submission.cells).length > 0 ||
          Boolean(
            crosswordDraftMeta &&
              (crosswordDraftMeta.startedAt ||
                crosswordDraftMeta.hintCountUsed ||
                crosswordDraftMeta.activeHintClueId ||
                crosswordDraftMeta.activeHintLevel ||
                (crosswordDraftMeta.revealedCellKeys?.length ?? 0) > 0)
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
    case "alphabet":
      return (
        submission.type === "alphabet" &&
        Object.keys(submission.assignments).length ===
          getAlphabetSymbolsInOrder(parsedPuzzle.data.lines).length
      );
    case "wordsearch":
      return (
        submission.type === "wordsearch" &&
        submission.foundWordIds.length === parsedPuzzle.data.words.length
      );
    case "crossword":
      return submission.type === "crossword" && Object.keys(submission.cells).length > 0;
  }
}

export default function QuestStepPlayer({
  questAccessId,
  questTitle,
  version,
  assistance,
  assistanceConfig,
  totalPenaltySeconds,
  restartCurrentStep,
  step,
  warningMessage,
}: QuestStepPlayerProps) {
  const t = getDictionary();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const [submission, setSubmission] = useState<PuzzleSubmission | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(version);
  const [stepAssistance, setStepAssistance] = useState(assistance);
  const [questPenaltySeconds, setQuestPenaltySeconds] = useState(totalPenaltySeconds);
  const [assistBusyAction, setAssistBusyAction] =
    useState<StepAssistAction | null>(null);
  const [draftPersistenceDisabled, setDraftPersistenceDisabled] = useState(false);
  const [sudokuDraftMeta, setSudokuDraftMeta] = useState<SudokuDraftMeta | null>(
    null
  );
  const [wordsearchDraftMeta, setWordsearchDraftMeta] =
    useState<WordsearchDraftMeta | null>(null);
  const [crosswordDraftMeta, setCrosswordDraftMeta] =
    useState<CrosswordDraftMeta | null>(null);
  const [successState, setSuccessState] = useState<{
    questCompleted: boolean;
    sudokuStats?: PuzzleCompletionStats;
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
    setCurrentVersion(version);
    setStepAssistance(assistance);
    setQuestPenaltySeconds(totalPenaltySeconds);
  }, [assistance, totalPenaltySeconds, version]);

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
    const nextSubmission = getStartingSubmission(parsedPuzzle, draft, assistance);

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
    setWordsearchDraftMeta(
      draft?.type === "wordsearch"
        ? {
            startedAt: draft.startedAt,
            hintCountUsed: draft.hintCountUsed,
            activeHintWordId: draft.activeHintWordId,
            activeHintLevel: draft.activeHintLevel,
            activeHintStartCell: draft.activeHintStartCell,
            activeHintDirection: draft.activeHintDirection,
            activeHintCells: draft.activeHintCells,
            foundWordCellsById: draft.foundWordCellsById,
          }
        : null
    );
    setCrosswordDraftMeta(
      draft?.type === "crossword"
        ? {
            startedAt: draft.startedAt,
            hintCountUsed: draft.hintCountUsed,
            activeHintClueId: draft.activeHintClueId,
            activeHintLevel: draft.activeHintLevel,
            revealedCellKeys: draft.revealedCellKeys,
          }
        : null
    );
    setHydrated(true);
  }, [
    assistance,
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

    if (
      shouldPersistDraft(
        parsedPuzzle,
        submission,
        sudokuDraftMeta,
        wordsearchDraftMeta,
        crosswordDraftMeta
      )
    ) {
      saveQuestDraft(
        draftKey.questAccessId,
        draftKey.stepDocumentId,
        draftKey.stepRevision,
        submission,
        submission.type === "sudoku"
          ? sudokuDraftMeta ?? undefined
          : submission.type === "wordsearch"
            ? wordsearchDraftMeta ?? undefined
            : submission.type === "crossword"
              ? crosswordDraftMeta ?? undefined
            : undefined
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
    wordsearchDraftMeta,
    crosswordDraftMeta,
  ]);

  async function handleSubmit(options?: {
    submissionOverride?: PuzzleSubmission;
    skipSuccessState?: boolean;
    sudokuStats?: PuzzleCompletionStats;
  }) {
    const activeSubmission = options?.submissionOverride ?? submission;

    if (!activeSubmission) {
      return null;
    }

    setLoading(true);
    setSuccessState(null);
    setError(null);
    setStatusTone("info");
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
          version: currentVersion,
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

      if (Number.isFinite(Number(data.version))) {
        setCurrentVersion(Number(data.version));
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
                    : parsedPuzzle?.type === "alphabet"
                      ? t.step.alphabetIncorrect
                      : parsedPuzzle?.type === "crossword"
                        ? t.step.crosswordIncorrect
                      : parsedPuzzle?.type === "wordsearch"
                        ? t.step.wordsearchReadyToValidate
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

    const nextSubmission = getStartingSubmission(parsedPuzzle, null, stepAssistance);
    clearQuestDraft(draftKey.questAccessId, draftKey.stepDocumentId);
    setDraftPersistenceDisabled(false);
    setSubmission(nextSubmission);
    setCanSubmit(defaultReadyState(parsedPuzzle, nextSubmission));
    setSudokuDraftMeta(null);
    setWordsearchDraftMeta(null);
    setCrosswordDraftMeta(null);
    setSuccessState(null);
    setStatus(null);
    setError(null);
  }

  async function handleAssist(action: StepAssistAction) {
    if (!submission || !parsedPuzzle) {
      return;
    }

    setAssistBusyAction(action);
    setError(null);
    setSuccessState(null);

    try {
      const response = await fetch("/api/steps/assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          questAccessId,
          stepDocumentId: step.documentId,
          submission,
          version: currentVersion,
        }),
      });

      const data = (await response.json()) as AssistResponse;

      if (!response.ok || !data.ok || !data.stepAssistance || !data.nextSubmission) {
        throw new Error(data.error ?? t.step.genericError);
      }

      const nextSubmission = parsePuzzleSubmission(parsedPuzzle.type, data.nextSubmission);

      setSubmission(nextSubmission);
      setCanSubmit(defaultReadyState(parsedPuzzle, nextSubmission));
      setStepAssistance(data.stepAssistance);
      setQuestPenaltySeconds(Number(data.totalPenaltySeconds ?? questPenaltySeconds));
      setCurrentVersion(Number(data.version ?? currentVersion));
      setDraftPersistenceDisabled(false);
      setStatusTone(action === "reveal" ? "reveal" : "hint");
      setStatus(data.statusMessage ?? null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : t.step.genericError
      );
    } finally {
      setAssistBusyAction(null);
    }
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
    stats: PuzzleCompletionStats
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

  async function handleAlphabetSolve(
    nextSubmission: AlphabetSubmission,
    stats: PuzzleCompletionStats
  ) {
    setSubmission(nextSubmission);
    setCanSubmit(
      Object.keys(nextSubmission.assignments).length ===
        getAlphabetSymbolsInOrder(
          parsedPuzzle?.type === "alphabet" ? parsedPuzzle.data.lines : []
        ).length
    );

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

  async function handleWordsearchSolve(
    nextSubmission: WordsearchSubmission,
    stats: WordsearchCompletionStats
  ) {
    setSubmission(nextSubmission);
    setCanSubmit(
      parsedPuzzle?.type === "wordsearch" &&
        nextSubmission.foundWordIds.length === parsedPuzzle.data.words.length
    );

    const result = await handleSubmit({
      submissionOverride: nextSubmission,
      skipSuccessState: true,
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

  async function handleCrosswordSolve(
    nextSubmission: CrosswordSubmission,
    stats: CrosswordCompletionStats
  ) {
    setSubmission(nextSubmission);
    setCanSubmit(Object.keys(nextSubmission.cells).length > 0);

    const result = await handleSubmit({
      submissionOverride: nextSubmission,
      skipSuccessState: true,
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
            revealedCellKeys={stepAssistance.uiState?.revealedCellKeys}
          />
        );
      case "alphabet":
        if (submission.type !== "alphabet") {
          return null;
        }

        return (
          <AlphabetPuzzle
            questAccessId={questAccessId}
            stepDocumentId={step.documentId}
            publicData={parsedPuzzle.data}
            value={submission}
            onChange={(next) => {
              setSubmission(next);
              setCanSubmit(
                Object.keys(next.assignments).length ===
                  getAlphabetSymbolsInOrder(parsedPuzzle.data.lines).length
              );
            }}
            onReadyChange={setCanSubmit}
            title={step.title || `${t.step.titlePrefix} ${step.order}`}
            successText={successText}
            onRequestSolve={handleAlphabetSolve}
            onContinueAfterComplete={handleContinueAfterSudoku}
            revealedSymbols={stepAssistance.uiState?.revealedSymbols}
          />
        );
      case "wordsearch":
        if (submission.type !== "wordsearch") {
          return null;
        }

        return (
          <WordsearchPuzzle
            questAccessId={questAccessId}
            stepDocumentId={step.documentId}
            publicData={parsedPuzzle.data}
            value={submission}
            onChange={(next) => {
              setSubmission(next);
              setCanSubmit(next.foundWordIds.length === parsedPuzzle.data.words.length);
            }}
            onReadyChange={setCanSubmit}
            initialMeta={wordsearchDraftMeta}
            title={step.title || `${t.step.titlePrefix} ${step.order}`}
            successText={successText}
            onDraftMetaChange={setWordsearchDraftMeta}
            onRequestSolve={handleWordsearchSolve}
            onContinueAfterComplete={handleContinueAfterSudoku}
            assistance={stepAssistance}
            assistanceHintLimit={assistanceConfig.maxSmallHints}
          />
        );
      case "crossword":
        if (submission.type !== "crossword") {
          return null;
        }

        return (
          <CrosswordPuzzle
            questAccessId={questAccessId}
            stepDocumentId={step.documentId}
            publicData={parsedPuzzle.data}
            value={submission}
            onChange={(next) => {
              setSubmission(next);
              setCanSubmit(Object.keys(next.cells).length > 0);
            }}
            onReadyChange={setCanSubmit}
            initialMeta={crosswordDraftMeta}
            title={step.title || `${t.step.titlePrefix} ${step.order}`}
            successText={successText}
            onDraftMetaChange={setCrosswordDraftMeta}
            onRequestSolve={handleCrosswordSolve}
            onContinueAfterComplete={handleContinueAfterSudoku}
            assistance={stepAssistance}
            assistanceHintLimit={assistanceConfig.maxSmallHints}
          />
        );
    }
  }

  return (
    <section className="relative space-y-6 rounded-lg border border-border bg-card p-6">
      {loading || assistBusyAction ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium shadow-sm">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            {loading
              ? status ?? t.step.validating
              : assistBusyAction === "hint"
                ? t.step.assistHintLoading
                : t.step.assistRevealLoading}
          </div>
        </div>
      ) : null}

      {successState &&
      parsedPuzzle?.type !== "sudoku" &&
      parsedPuzzle?.type !== "alphabet" ? (
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

      <StepAssistancePanel
        busyAction={assistBusyAction}
        canHint={
          !stepAssistance.revealUsed &&
          stepAssistance.hintUses < assistanceConfig.maxSmallHints
        }
        canReveal={!stepAssistance.revealUsed}
        hintUses={stepAssistance.hintUses}
        maxSmallHints={assistanceConfig.maxSmallHints}
        stepPenaltySeconds={stepAssistance.penaltySeconds}
        totalPenaltySeconds={questPenaltySeconds}
        hintPenaltySeconds={assistanceConfig.hintPenaltySeconds}
        revealPenaltySeconds={assistanceConfig.revealPenaltySeconds}
        onHint={() => {
          void handleAssist("hint");
        }}
        onReveal={() => {
          void handleAssist("reveal");
        }}
      />

      {parsedPuzzle?.type !== "sudoku" &&
      parsedPuzzle?.type !== "alphabet" &&
      parsedPuzzle?.type !== "wordsearch" &&
      parsedPuzzle?.type !== "crossword" ? (
        <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading || assistBusyAction !== null || !canSubmit}
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
              disabled={loading || assistBusyAction !== null}
              onClick={handleResetStep}
              className="inline-flex rounded-md border border-border bg-background px-4 py-2 text-foreground hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t.step.resetStep}
            </button>
          ) : null}
        </div>
      ) : null}

      {status && !loading ? (
        <div
          className={[
            "rounded-2xl border px-4 py-4 shadow-lg",
            statusTone === "hint"
              ? "border-amber-300/70 bg-amber-100 text-amber-950 dark:border-amber-200/80 dark:bg-amber-300/90 dark:text-slate-950"
              : statusTone === "reveal"
                ? "border-orange-300/70 bg-orange-100 text-orange-950 dark:border-orange-200/80 dark:bg-orange-300/92 dark:text-slate-950"
                : "border-primary/25 bg-primary/10 text-card-foreground",
          ].join(" ")}
        >
          <div className="flex items-start gap-3">
            <span
              className={[
                "mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-black shadow-sm",
                statusTone === "hint"
                  ? "bg-white/80 text-amber-700 dark:bg-amber-50/80 dark:text-amber-700"
                  : statusTone === "reveal"
                    ? "bg-white/80 text-orange-700 dark:bg-orange-50/85 dark:text-orange-700"
                    : "bg-primary/15 text-primary",
              ].join(" ")}
            >
              !
            </span>
            <p className="text-sm font-semibold leading-6 text-current">{status}</p>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
