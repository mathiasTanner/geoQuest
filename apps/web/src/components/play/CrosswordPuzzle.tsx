"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getDictionary } from "@/lib/i18n";
import type { CrosswordDraftMeta } from "@/lib/offline/questDrafts";
import {
  buildCrosswordCellValues,
  getCrosswordCellMemberships,
  getCrosswordClueCells,
  getCrosswordClueLetters,
  getCrosswordCluesInOrder,
  type CrosswordHintLevel,
  type CrosswordPuzzleClue,
  type CrosswordPuzzlePublicData,
  type CrosswordSubmission,
} from "@/lib/quests/puzzleTypes";
import type { StepAssistanceSnapshot } from "@/lib/quests/stepAssistance";

type CrosswordCompletionStats = {
  durationMs: number;
  hintCountUsed: number;
  filledClueCount: number;
};

type CrosswordPuzzleProps = {
  questAccessId: string;
  stepDocumentId: string;
  publicData: CrosswordPuzzlePublicData;
  value: CrosswordSubmission;
  onChange: (next: CrosswordSubmission) => void;
  onReadyChange: (ready: boolean) => void;
  initialMeta?: CrosswordDraftMeta | null;
  title: string;
  successText?: string;
  assistance?: StepAssistanceSnapshot | null;
  assistanceHintLimit: number;
  onDraftMetaChange: (next: CrosswordDraftMeta | null) => void;
  onRequestSolve: (
    nextSubmission: CrosswordSubmission,
    stats: CrosswordCompletionStats
  ) => Promise<{ questCompleted: boolean; stats: CrosswordCompletionStats } | null>;
  onContinueAfterComplete: (questCompleted: boolean) => void;
};

type EvaluateResponse = {
  ok?: boolean;
  evaluation?: {
    complete: boolean;
    solved: boolean;
    wrongClueIds: string[];
    wrongCells: Array<{ row: number; col: number }>;
    filledClueCount: number;
    totalClueCount: number;
  };
  error?: string;
};

type FlashState = {
  variant: "success" | "error" | "info";
  message: string;
};

type CompletionState = {
  questCompleted: boolean;
  durationMs: number;
  hintCountUsed: number;
  filledClueCount: number;
};

function getCellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function formatDuration(totalMs: number) {
  const totalSeconds = Math.max(Math.round(totalMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function normalizeLetterSequence(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .split("")
    .filter((entry) => entry.length === 1);
}

function serializeCrosswordMeta(meta: CrosswordDraftMeta | null | undefined) {
  return JSON.stringify({
    startedAt: meta?.startedAt ?? null,
    hintCountUsed: meta?.hintCountUsed ?? null,
    activeHintClueId: meta?.activeHintClueId ?? null,
    activeHintLevel: meta?.activeHintLevel ?? null,
    revealedCellKeys: [...(meta?.revealedCellKeys ?? [])].sort(),
  });
}

function getDirectionLabel(
  clue: CrosswordPuzzleClue,
  labels: { across: string; down: string }
) {
  return clue.direction === "across" ? labels.across : labels.down;
}

export default function CrosswordPuzzle({
  questAccessId,
  stepDocumentId,
  publicData,
  value,
  onChange,
  onReadyChange,
  initialMeta,
  title,
  successText,
  assistance,
  assistanceHintLimit,
  onDraftMetaChange,
  onRequestSolve,
  onContinueAfterComplete,
}: CrosswordPuzzleProps) {
  const t = getDictionary();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const stickyDockRef = useRef<HTMLDivElement | null>(null);
  const orderedClues = useMemo(
    () => getCrosswordCluesInOrder(publicData.clues),
    [publicData.clues]
  );
  const cluesById = useMemo(
    () => new Map(orderedClues.map((clue) => [clue.id, clue] as const)),
    [orderedClues]
  );
  const membershipMap = useMemo(
    () => getCrosswordCellMemberships(publicData.clues),
    [publicData.clues]
  );
  const numberByCellKey = useMemo(() => {
    const numbers = new Map<string, number>();

    orderedClues.forEach((clue) => {
      const cellKey = getCellKey(clue.row, clue.col);

      if (!numbers.has(cellKey)) {
        numbers.set(cellKey, clue.number);
      }
    });

    return numbers;
  }, [orderedClues]);
  const acrossClues = useMemo(
    () => orderedClues.filter((clue) => clue.direction === "across"),
    [orderedClues]
  );
  const downClues = useMemo(
    () => orderedClues.filter((clue) => clue.direction === "down"),
    [orderedClues]
  );
  const [selectedClueId, setSelectedClueId] = useState<string | null>(
    orderedClues[0]?.id ?? null
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [puzzleError, setPuzzleError] = useState<string | null>(null);
  const [flashState, setFlashState] = useState<FlashState | null>(null);
  const [wrongCellKeys, setWrongCellKeys] = useState<string[]>([]);
  const [wrongClueIds, setWrongClueIds] = useState<string[]>([]);
  const [hintCountUsed, setHintCountUsed] = useState(initialMeta?.hintCountUsed ?? 0);
  const [startedAt, setStartedAt] = useState(initialMeta?.startedAt ?? Date.now());
  const [nowMs, setNowMs] = useState(Date.now());
  const [busyAction, setBusyAction] = useState<"check" | "hint" | "solve" | null>(null);
  const [activeHintClueId, setActiveHintClueId] = useState<string | null>(
    initialMeta?.activeHintClueId ?? null
  );
  const [activeHintLevel, setActiveHintLevel] = useState<CrosswordHintLevel | null>(
    initialMeta?.activeHintLevel ?? null
  );
  const [revealedCellKeys, setRevealedCellKeys] = useState<string[]>(
    initialMeta?.revealedCellKeys ?? []
  );
  const [completionState, setCompletionState] = useState<CompletionState | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [stickyDockHeight, setStickyDockHeight] = useState(0);
  const resetKey = useMemo(
    () =>
      JSON.stringify({
        questAccessId,
        stepDocumentId,
        grid: publicData.grid,
        clues: orderedClues.map((clue) => clue.id),
      }),
    [orderedClues, publicData.grid, questAccessId, stepDocumentId]
  );
  const selectedClue =
    (selectedClueId ? cluesById.get(selectedClueId) : null) ?? orderedClues[0] ?? null;
  const selectedClueCells = selectedClue ? getCrosswordClueCells(selectedClue) : [];
  const selectedClueLetters = selectedClue
    ? getCrosswordClueLetters(selectedClue, value.cells)
    : [];
  const selectedCellKey =
    selectedClueCells[selectedIndex] &&
    getCellKey(selectedClueCells[selectedIndex].row, selectedClueCells[selectedIndex].col);
  const selectedClueCellKeys = useMemo(
    () =>
      new Set(
        selectedClueCells.map((cell) => getCellKey(cell.row, cell.col))
      ),
    [selectedClueCells]
  );
  const revealedCellKeySet = useMemo(
    () => new Set(revealedCellKeys),
    [revealedCellKeys]
  );
  const filledClueCount = useMemo(
    () =>
      orderedClues.filter((clue) =>
        getCrosswordClueLetters(clue, value.cells).every(Boolean)
      ).length,
    [orderedClues, value.cells]
  );
  const hintsRemaining = Math.max(assistanceHintLimit - hintCountUsed, 0);
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        left: `${7 + ((index + 1) * 4.9) % 86}%`,
        delay: `${(index % 6) * 60}ms`,
        duration: `${920 + (index % 5) * 130}ms`,
        rotation: `${(index * 29) % 360}deg`,
        drift: `${-32 + ((index * 17) % 64)}px`,
        color: ["#3d8bfd", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444"][
          index % 6
        ],
      })),
    []
  );

  useEffect(() => {
    onReadyChange(filledClueCount > 0);
  }, [filledClueCount, onReadyChange]);

  useEffect(() => {
    setSelectedClueId(orderedClues[0]?.id ?? null);
    setSelectedIndex(0);
    setStatusMessage(null);
    setPuzzleError(null);
    setFlashState(null);
    setWrongCellKeys([]);
    setWrongClueIds([]);
    setHintCountUsed(initialMeta?.hintCountUsed ?? 0);
    setStartedAt(initialMeta?.startedAt ?? Date.now());
    setNowMs(Date.now());
    setBusyAction(null);
    setActiveHintClueId(initialMeta?.activeHintClueId ?? null);
    setActiveHintLevel(initialMeta?.activeHintLevel ?? null);
    setRevealedCellKeys(initialMeta?.revealedCellKeys ?? []);
    setCompletionState(null);
    setHelpOpen(false);
    setCelebrate(false);
  }, [initialMeta, orderedClues, resetKey]);

  useEffect(() => {
    if (!assistance) {
      return;
    }

    setHintCountUsed(assistance.hintUses);
    setActiveHintClueId(assistance.uiState?.activeHintClueId ?? null);
    setActiveHintLevel(null);

    if (assistance.uiState?.revealedCellKeys) {
      setRevealedCellKeys((current) =>
        Array.from(
          new Set([...current, ...assistance.uiState!.revealedCellKeys!])
        ).sort()
      );
    }
  }, [
    assistance,
    assistance?.hintUses,
    assistance?.uiState?.activeHintClueId,
    assistance?.uiState?.revealedCellKeys,
  ]);

  useEffect(() => {
    if (completionState) {
      return;
    }

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [completionState]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const element = stickyDockRef.current;

    if (!element) {
      return;
    }

    const updateDockHeight = () => {
      setStickyDockHeight(element.getBoundingClientRect().height);
    };

    updateDockHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateDockHeight);
      return () => {
        window.removeEventListener("resize", updateDockHeight);
      };
    }

    const observer = new ResizeObserver(() => {
      updateDockHeight();
    });

    observer.observe(element);
    window.addEventListener("resize", updateDockHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDockHeight);
    };
  }, []);

  useEffect(() => {
    const nextMeta: CrosswordDraftMeta = {
      startedAt,
      hintCountUsed,
      activeHintClueId: activeHintClueId ?? undefined,
      activeHintLevel: activeHintLevel ?? undefined,
      revealedCellKeys: revealedCellKeys.length > 0 ? [...revealedCellKeys] : undefined,
    };

    if (serializeCrosswordMeta(initialMeta) !== serializeCrosswordMeta(nextMeta)) {
      onDraftMetaChange(nextMeta);
    }
  }, [
    activeHintClueId,
    activeHintLevel,
    hintCountUsed,
    initialMeta,
    onDraftMetaChange,
    revealedCellKeys,
    startedAt,
  ]);

  function focusInput() {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function showFlash(nextFlash: FlashState) {
    setFlashState(nextFlash);

    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }

    flashTimerRef.current = window.setTimeout(() => {
      setFlashState(null);
    }, 1300);
  }

  function replaceCells(nextCells: Record<string, string>) {
    const normalizedCells = buildCrosswordCellValues(nextCells);

    if (JSON.stringify(normalizedCells) === JSON.stringify(value.cells)) {
      return;
    }

    onChange({
      type: "crossword",
      cells: normalizedCells,
    });
  }

  function getNextEditableIndex(
    clue: CrosswordPuzzleClue,
    startIndex: number
  ) {
    const clueCells = getCrosswordClueCells(clue);

    for (let index = Math.max(startIndex, 0); index < clueCells.length; index += 1) {
      const cell = clueCells[index];

      if (!revealedCellKeySet.has(getCellKey(cell.row, cell.col))) {
        return index;
      }
    }

    return -1;
  }

  function getPreviousEditableIndex(
    clue: CrosswordPuzzleClue,
    startIndex: number
  ) {
    const clueCells = getCrosswordClueCells(clue);

    for (
      let index = Math.min(startIndex, clueCells.length - 1);
      index >= 0;
      index -= 1
    ) {
      const cell = clueCells[index];

      if (!revealedCellKeySet.has(getCellKey(cell.row, cell.col))) {
        return index;
      }
    }

    return -1;
  }

  function selectClue(clueId: string, preferredIndex = 0) {
    const clue = cluesById.get(clueId);

    if (!clue) {
      return;
    }

    setSelectedClueId(clueId);
    setSelectedIndex(
      getNextEditableIndex(clue, preferredIndex) !== -1
        ? getNextEditableIndex(clue, preferredIndex)
        : preferredIndex
    );
    setStatusMessage(null);
    setPuzzleError(null);
    focusInput();
  }

  function handleGridCellPress(row: number, col: number) {
    const key = getCellKey(row, col);
    const memberships = membershipMap.get(key) ?? [];

    if (memberships.length === 0) {
      return;
    }

    if (selectedClueId) {
      const currentMembership = memberships.find(
        (membership) => membership.clueId === selectedClueId
      );

      if (currentMembership) {
        const alternateMembership = memberships.find(
          (membership) => membership.clueId !== selectedClueId
        );

        if (alternateMembership) {
          selectClue(alternateMembership.clueId, alternateMembership.index);
          return;
        }

        selectClue(selectedClueId, currentMembership.index);
        return;
      }
    }

    const preferredMembership =
      memberships.find((membership) => membership.direction === "across") ??
      memberships[0];

    selectClue(preferredMembership.clueId, preferredMembership.index);
  }

  function handleLetterSequence(letters: string[]) {
    if (!selectedClue || letters.length === 0) {
      return;
    }

    const clueCells = getCrosswordClueCells(selectedClue);
    const nextCells = { ...value.cells };
    let cursor = selectedIndex;

    letters.forEach((letter) => {
      const editableIndex = getNextEditableIndex(selectedClue, cursor);

      if (editableIndex === -1) {
        return;
      }

      const cell = clueCells[editableIndex];
      nextCells[getCellKey(cell.row, cell.col)] = letter;
      cursor = editableIndex + 1;
    });

    replaceCells(nextCells);

    const nextEditableIndex = getNextEditableIndex(selectedClue, cursor);
    setSelectedIndex(
      nextEditableIndex === -1
        ? Math.min(cursor - 1, clueCells.length - 1)
        : nextEditableIndex
    );
    setStatusMessage(null);
    setPuzzleError(null);
  }

  function handleBackspace() {
    if (!selectedClue) {
      return;
    }

    const clueCells = getCrosswordClueCells(selectedClue);
    const nextCells = { ...value.cells };
    let targetIndex = selectedIndex;
    const currentCell = clueCells[targetIndex];
    const currentKey = currentCell
      ? getCellKey(currentCell.row, currentCell.col)
      : null;

    if (
      currentKey &&
      !revealedCellKeySet.has(currentKey) &&
      typeof nextCells[currentKey] === "string"
    ) {
      delete nextCells[currentKey];
      replaceCells(nextCells);
      setSelectedIndex(targetIndex);
      return;
    }

    targetIndex = getPreviousEditableIndex(selectedClue, selectedIndex - 1);

    if (targetIndex === -1) {
      return;
    }

    const targetCell = clueCells[targetIndex];
    const targetKey = getCellKey(targetCell.row, targetCell.col);

    delete nextCells[targetKey];
    replaceCells(nextCells);
    setSelectedIndex(targetIndex);
    setStatusMessage(null);
    setPuzzleError(null);
  }

  async function requestEvaluation() {
    const response = await fetch("/api/steps/crossword/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        questAccessId,
        stepDocumentId,
        cells: value.cells,
      }),
    });
    const data = (await response.json()) as EvaluateResponse;

    if (!response.ok || !data.ok || !data.evaluation) {
      throw new Error(data.error ?? t.step.crosswordEvaluationError);
    }

    return data.evaluation;
  }

  async function handleCheck() {
    setBusyAction("check");
    setPuzzleError(null);
    setStatusMessage(null);

    try {
      const evaluation = await requestEvaluation();
      const nextWrongCellKeys = evaluation.wrongCells.map((cell) =>
        getCellKey(cell.row, cell.col)
      );

      setWrongCellKeys(nextWrongCellKeys);
      setWrongClueIds(evaluation.wrongClueIds);

      if (nextWrongCellKeys.length === 0) {
        setStatusMessage(t.step.crosswordCheckSuccess);
        showFlash({
          variant: "success",
          message: t.step.crosswordCheckSuccess,
        });
        return;
      }

      setStatusMessage(t.step.crosswordCheckErrors);
      showFlash({
        variant: "error",
        message: t.step.crosswordCheckErrors,
      });
    } catch (error) {
      setPuzzleError(
        error instanceof Error ? error.message : t.step.crosswordEvaluationError
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSolve() {
    setBusyAction("solve");
    setPuzzleError(null);
    setStatusMessage(null);

    try {
      const evaluation = await requestEvaluation();
      const nextWrongCellKeys = evaluation.wrongCells.map((cell) =>
        getCellKey(cell.row, cell.col)
      );

      setWrongCellKeys(nextWrongCellKeys);
      setWrongClueIds(evaluation.wrongClueIds);

      if (!evaluation.solved) {
        setStatusMessage(
          evaluation.complete
            ? t.step.crosswordSolveErrors
            : t.step.crosswordSolveIncomplete
        );
        return;
      }

      const durationMs = Math.max(Date.now() - startedAt, 0);
      const result = await onRequestSolve(value, {
        durationMs,
        hintCountUsed,
        filledClueCount: evaluation.filledClueCount,
      });

      if (!result) {
        return;
      }

      setCompletionState({
        questCompleted: result.questCompleted,
        durationMs: result.stats.durationMs,
        hintCountUsed: result.stats.hintCountUsed,
        filledClueCount: result.stats.filledClueCount,
      });
      setWrongCellKeys([]);
      setWrongClueIds([]);
      setNowMs(Date.now());
      setCelebrate(false);
      requestAnimationFrame(() => {
        setCelebrate(true);
      });
    } catch (error) {
      setPuzzleError(
        error instanceof Error ? error.message : t.step.crosswordEvaluationError
      );
    } finally {
      setBusyAction(null);
    }
  }

  function handleReset() {
    replaceCells({});
    setSelectedClueId(orderedClues[0]?.id ?? null);
    setSelectedIndex(0);
    setStatusMessage(null);
    setPuzzleError(null);
    setFlashState(null);
    setWrongCellKeys([]);
    setWrongClueIds([]);
    setHintCountUsed(assistance?.hintUses ?? 0);
    setStartedAt(Date.now());
    setNowMs(Date.now());
    setBusyAction(null);
    setActiveHintClueId(assistance?.uiState?.activeHintClueId ?? null);
    setActiveHintLevel(null);
    setRevealedCellKeys([...(assistance?.uiState?.revealedCellKeys ?? [])].sort());
    setCompletionState(null);
    setCelebrate(false);
  }

  if (completionState) {
    return (
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card/80 p-5 shadow-sm">
        {celebrate ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {confettiPieces.map((piece) => (
              <span
                key={`crossword-confetti-${piece.id}`}
                className="crossword-confetti"
                style={
                  {
                    left: piece.left,
                    animationDelay: piece.delay,
                    animationDuration: piece.duration,
                    backgroundColor: piece.color,
                    ["--crossword-confetti-rotate" as "--crossword-confetti-rotate"]:
                      piece.rotation,
                    ["--crossword-confetti-drift" as "--crossword-confetti-drift"]:
                      piece.drift,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ) : null}

        <div className={celebrate ? "crossword-finish-card crossword-finish-card-active" : "crossword-finish-card"}>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {t.step.crosswordCompletionEyebrow}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{title}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            {t.step.crosswordCompletionTitle}
          </h2>
          <p className="mt-4 whitespace-pre-line text-base leading-7 text-card-foreground">
            {successText ||
              (completionState.questCompleted
                ? t.step.successCompletedBody
                : t.step.successDefaultBody)}
          </p>

          <dl className="mt-6 grid gap-3 rounded-2xl border border-border bg-background/70 p-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">{t.step.crosswordStatTime}</dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatDuration(completionState.durationMs)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t.step.crosswordStatHints}</dt>
              <dd className="mt-1 text-xl font-semibold">
                {completionState.hintCountUsed}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t.step.crosswordStatClues}</dt>
              <dd className="mt-1 text-xl font-semibold">
                {completionState.filledClueCount}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => onContinueAfterComplete(completionState.questCompleted)}
            className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-[var(--color-primary-hover)]"
          >
            {completionState.questCompleted
              ? t.step.successQuestComplete
              : t.step.successContinue}
          </button>
        </div>

        <style>{`
          .crossword-finish-card {
            transform-origin: center top;
          }

          .crossword-finish-card-active {
            animation: crossword-board-settle 520ms ease-out forwards;
          }

          .crossword-confetti {
            position: absolute;
            top: -8%;
            width: 0.7rem;
            height: 1.2rem;
            border-radius: 999px;
            opacity: 0;
            animation: crossword-confetti-fall ease-out forwards;
            transform: rotate(var(--crossword-confetti-rotate));
          }

          @keyframes crossword-board-settle {
            0% {
              transform: scale(1);
            }

            60% {
              transform: scale(0.95);
            }

            100% {
              transform: scale(0.97);
            }
          }

          @keyframes crossword-confetti-fall {
            0% {
              opacity: 0;
              transform: translate3d(0, -14px, 0) rotate(0deg);
            }

            14% {
              opacity: 1;
            }

            100% {
              opacity: 0;
              transform: translate3d(var(--crossword-confetti-drift, 0), 240px, 0)
                rotate(calc(var(--crossword-confetti-rotate, 0deg) + 320deg));
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className="space-y-5"
      style={{
        paddingBottom: `calc(${Math.max(stickyDockHeight, 0)}px + env(safe-area-inset-bottom, 0px) + 1rem)`,
      }}
    >
      {helpOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-border bg-card p-6 shadow-2xl">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {t.step.crosswordHelpTitle}
              </p>
              <p className="whitespace-pre-line text-base leading-7 text-card-foreground">
                {publicData.helpText || t.step.crosswordHelpDefaultBody}
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="inline-flex rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
              >
                {t.step.crosswordHelpClose}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="sr-only"
        onChange={(event) => {
          const letters = normalizeLetterSequence(event.currentTarget.value);

          if (letters.length > 0) {
            handleLetterSequence(letters);
          }

          event.currentTarget.value = "";
        }}
        onKeyDown={(event) => {
          if (!selectedClue) {
            return;
          }

          if (event.key === "Backspace") {
            event.preventDefault();
            handleBackspace();
            return;
          }

          if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((current) =>
              getPreviousEditableIndex(selectedClue, current - 1) !== -1
                ? getPreviousEditableIndex(selectedClue, current - 1)
                : Math.max(current - 1, 0)
            );
            return;
          }

          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((current) =>
              getNextEditableIndex(selectedClue, current + 1) !== -1
                ? getNextEditableIndex(selectedClue, current + 1)
                : Math.min(current + 1, selectedClue.length - 1)
            );
          }
        }}
      />

      <div className="relative space-y-4">
        {flashState ? (
          <div className="pointer-events-none absolute inset-x-0 -top-3 z-20 flex justify-center px-3">
            <div
              className={[
                "crossword-flash w-full max-w-md rounded-2xl border px-4 py-3 text-center text-sm font-medium shadow-2xl",
                flashState.variant === "success"
                  ? "border-emerald-200/70 bg-emerald-500/92 text-white"
                  : flashState.variant === "error"
                    ? "border-red-200/70 bg-red-500/92 text-white"
                    : "border-amber-200/80 bg-amber-300/95 text-slate-950",
              ].join(" ")}
            >
              {flashState.message}
            </div>
          </div>
        ) : null}

        <div className="rounded-[2rem] border border-border bg-card/80 p-4 shadow-sm sm:p-6">
          <div className="mx-auto w-full max-w-[34rem] rounded-[1.75rem] border border-border bg-background/70 p-2 sm:p-3">
            <div
              className="grid gap-1 sm:gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${Math.max(publicData.grid[0]?.length ?? 1, 1)}, minmax(0, 1fr))`,
              }}
            >
              {publicData.grid.map((row, rowIndex) =>
                row.split("").map((cell, colIndex) => {
                  const key = getCellKey(rowIndex, colIndex);
                  const cellLetter = value.cells[key] ?? "";
                  const isBlocked = cell === "#";
                  const isSelectedClueCell = selectedClueCellKeys.has(key);
                  const isSelectedCell = selectedCellKey === key;
                  const isWrong = wrongCellKeys.includes(key);
                  const isRevealed = revealedCellKeySet.has(key);
                  const isHinted =
                    activeHintClueId &&
                    membershipMap
                      .get(key)
                      ?.some((membership) => membership.clueId === activeHintClueId);

                  if (isBlocked) {
                    return (
                      <div
                        key={key}
                        className="aspect-square rounded-xl bg-foreground/10"
                      />
                    );
                  }

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        handleGridCellPress(rowIndex, colIndex);
                        focusInput();
                      }}
                      className={[
                        "relative aspect-square rounded-xl border text-center text-sm font-semibold uppercase transition sm:text-base",
                        isSelectedCell
                          ? "border-primary bg-primary/18 text-primary shadow-[0_0_0_1px_rgba(61,139,253,0.18)]"
                          : isSelectedClueCell
                            ? "border-primary/40 bg-primary/10 text-card-foreground"
                            : "border-border bg-card text-card-foreground",
                        isRevealed ? "text-slate-950" : "",
                        isHinted && !isSelectedClueCell
                          ? "border-amber-300/70 bg-amber-200/80 shadow-[0_0_0_1px_rgba(252,211,77,0.12)]"
                          : "",
                        isWrong ? "border-destructive bg-destructive/10 text-destructive" : "",
                      ].join(" ")}
                    >
                      {numberByCellKey.has(key) ? (
                        <span className="absolute left-1.5 top-1 text-[0.58rem] font-semibold text-muted-foreground sm:text-[0.64rem]">
                          {numberByCellKey.get(key)}
                        </span>
                      ) : null}
                      <span className="flex h-full items-center justify-center">
                        {cellLetter || ""}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedClue ? (
        <button
          type="button"
          onClick={focusInput}
          className="w-full rounded-[1.75rem] border border-border bg-card/80 p-4 text-left shadow-sm transition hover:border-primary/40"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {selectedClue.number}{" "}
                {getDirectionLabel(selectedClue, {
                  across: t.step.crosswordDirectionAcross,
                  down: t.step.crosswordDirectionDown,
                })}
              </p>
              <p className="mt-2 text-base font-medium text-card-foreground">
                {selectedClue.clue}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.step.crosswordTypeToFill}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {selectedClueCells.map((cell, index) => {
              const key = getCellKey(cell.row, cell.col);
              const letter = value.cells[key] ?? "";
              const isSelected = selectedIndex === index;
              const isRevealed = revealedCellKeySet.has(key);
              const isWrong = wrongCellKeys.includes(key);

              return (
                <span
                  key={`selected-clue-cell-${key}`}
                  className={[
                    "flex h-11 w-11 items-center justify-center rounded-2xl border text-base font-semibold uppercase transition",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-card-foreground",
                    isRevealed
                      ? "border-amber-300/80 bg-amber-300/90 text-slate-950 shadow-[0_0_0_1px_rgba(252,211,77,0.16)]"
                      : "",
                    isWrong ? "border-destructive bg-destructive/10 text-destructive" : "",
                  ].join(" ")}
                >
                  {letter || "\u00a0"}
                </span>
              );
            })}
          </div>
        </button>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[1.5rem] border border-border bg-card/70 p-4">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t.step.crosswordAcrossTitle}
          </p>
          <div className="mt-3 space-y-2">
            {acrossClues.map((clue) => {
              const isSelected = selectedClue?.id === clue.id;
              const isWrong = wrongClueIds.includes(clue.id);
              const isHinted = activeHintClueId === clue.id;

              return (
                <button
                  key={clue.id}
                  type="button"
                  onClick={() => selectClue(clue.id)}
                  className={[
                    "w-full rounded-2xl border px-4 py-3 text-left transition",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/70 hover:border-primary/40",
                    isWrong ? "border-destructive bg-destructive/10" : "",
                    isHinted && !isSelected
                      ? "border-amber-300/70 bg-amber-200/80 shadow-[0_0_0_1px_rgba(252,211,77,0.12)]"
                      : "",
                  ].join(" ")}
                >
                  <p className="text-sm font-semibold text-card-foreground">
                    {clue.number}. {clue.clue}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/70 p-4">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t.step.crosswordDownTitle}
          </p>
          <div className="mt-3 space-y-2">
            {downClues.map((clue) => {
              const isSelected = selectedClue?.id === clue.id;
              const isWrong = wrongClueIds.includes(clue.id);
              const isHinted = activeHintClueId === clue.id;

              return (
                <button
                  key={clue.id}
                  type="button"
                  onClick={() => selectClue(clue.id)}
                  className={[
                    "w-full rounded-2xl border px-4 py-3 text-left transition",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/70 hover:border-primary/40",
                    isWrong ? "border-destructive bg-destructive/10" : "",
                    isHinted && !isSelected
                      ? "border-amber-300/70 bg-amber-200/80 shadow-[0_0_0_1px_rgba(252,211,77,0.12)]"
                      : "",
                  ].join(" ")}
                >
                  <p className="text-sm font-semibold text-card-foreground">
                    {clue.number}. {clue.clue}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {statusMessage ? (
        <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-muted-foreground">
          {statusMessage}
        </div>
      ) : null}
      {puzzleError ? <p className="text-sm text-destructive">{puzzleError}</p> : null}

      <div
        ref={stickyDockRef}
        className="sticky bottom-3 z-20 rounded-[2rem] border border-border bg-card/95 p-3 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/85"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
        }}
      >
        <div className="mb-3 rounded-xl border border-border bg-background/60 p-3">
          <dl className="grid grid-cols-3 gap-3 text-xs text-muted-foreground sm:text-sm">
            <div>
              <dt>{t.step.crosswordStatTime}</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">
                {formatDuration(nowMs - startedAt)}
              </dd>
            </div>
            <div>
              <dt>{t.step.crosswordStatClues}</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">
                {t.step.crosswordProgressLabel
                  .replace("{filled}", String(filledClueCount))
                  .replace("{total}", String(orderedClues.length))}
              </dd>
            </div>
            <div>
              <dt>{t.step.crosswordStatHints}</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">
                {t.step.crosswordHintsRemaining.replace(
                  "{count}",
                  String(hintsRemaining)
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={focusInput}
            disabled={busyAction !== null}
            className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-card-foreground transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.step.crosswordTypeButton}
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            disabled={busyAction !== null}
            className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-card-foreground transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.step.crosswordHelpButton}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleCheck();
            }}
            disabled={busyAction !== null}
            className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-card-foreground transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === "check" ? t.step.crosswordChecking : t.step.crosswordCheckButton}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSolve();
            }}
            disabled={busyAction !== null}
            className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === "solve" ? t.step.crosswordSolving : t.step.crosswordSolveButton}
          </button>
        </div>

        <div className="mt-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={busyAction !== null}
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-card-foreground transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.step.crosswordResetButton}
          </button>
        </div>
      </div>

      <style>{`
        .crossword-flash {
          animation: crossword-flash-fade 1.3s ease-out forwards;
        }

        @keyframes crossword-flash-fade {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }

          18%,
          72% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }

          100% {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }
        }
      `}</style>
    </div>
  );
}
