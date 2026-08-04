"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getDictionary } from "@/lib/i18n";
import type { WordsearchDraftMeta } from "@/lib/offline/questDrafts";
import {
  buildWordsearchCellsBetween,
  type WordsearchCell,
  type WordsearchDirection,
  type WordsearchHintLevel,
  type WordsearchPuzzlePublicData,
  type WordsearchSelectionEvaluation,
  type WordsearchSubmission,
} from "@/lib/quests/puzzleTypes";
import type { StepAssistanceSnapshot } from "@/lib/quests/stepAssistance";

type WordsearchCompletionStats = {
  durationMs: number;
  hintCountUsed: number;
  foundCount: number;
};

type WordsearchPuzzleProps = {
  questAccessId: string;
  stepDocumentId: string;
  publicData: WordsearchPuzzlePublicData;
  value: WordsearchSubmission;
  onChange: (next: WordsearchSubmission) => void;
  onReadyChange: (ready: boolean) => void;
  initialMeta?: WordsearchDraftMeta | null;
  title: string;
  successText?: string;
  assistance?: StepAssistanceSnapshot | null;
  assistanceHintLimit: number;
  onDraftMetaChange: (next: WordsearchDraftMeta | null) => void;
  onRequestSolve: (
    nextSubmission: WordsearchSubmission,
    stats: WordsearchCompletionStats
  ) => Promise<{ questCompleted: boolean; stats: WordsearchCompletionStats } | null>;
  onContinueAfterComplete: (questCompleted: boolean) => void;
};

type EvaluateResponse = {
  ok?: boolean;
  evaluation?: WordsearchSelectionEvaluation;
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
  foundCount: number;
};

type GestureState = {
  anchor: WordsearchCell;
  current: WordsearchCell;
  moved: boolean;
  pointerId: number;
};

function getCellKey(cell: WordsearchCell) {
  return `${cell.row}:${cell.col}`;
}

function areSameCell(left: WordsearchCell | null, right: WordsearchCell | null) {
  return left?.row === right?.row && left?.col === right?.col;
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

function cloneWordsearchCell(cell?: WordsearchCell | null) {
  if (!cell) {
    return undefined;
  }

  return {
    row: Number(cell.row),
    col: Number(cell.col),
  } satisfies WordsearchCell;
}

function cloneWordsearchCellList(cells?: WordsearchCell[] | null) {
  if (!cells) {
    return undefined;
  }

  return cells.map((cell) => ({
    row: Number(cell.row),
    col: Number(cell.col),
  }));
}

function cloneFoundWordCellsById(
  value?: Record<string, WordsearchCell[]> | null
): Record<string, WordsearchCell[]> {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([wordId, cells]) => [wordId, cloneWordsearchCellList(cells) ?? []])
  );
}

function serializeWordsearchMeta(meta: WordsearchDraftMeta | null | undefined) {
  return JSON.stringify({
    startedAt: meta?.startedAt ?? null,
    hintCountUsed: meta?.hintCountUsed ?? null,
    activeHintWordId: meta?.activeHintWordId ?? null,
    activeHintLevel: meta?.activeHintLevel ?? null,
    activeHintStartCell: meta?.activeHintStartCell
      ? `${meta.activeHintStartCell.row}:${meta.activeHintStartCell.col}`
      : null,
    activeHintDirection: meta?.activeHintDirection ?? null,
    activeHintCells:
      meta?.activeHintCells?.map((cell) => `${cell.row}:${cell.col}`) ?? [],
    foundWordCellsById: Object.fromEntries(
      Object.entries(meta?.foundWordCellsById ?? {})
        .sort(([left], [right]) => left.localeCompare(right, "fr-CH"))
        .map(([wordId, cells]) => [
          wordId,
          cells.map((cell) => `${cell.row}:${cell.col}`),
        ])
    ),
  });
}

function getDirectionLabel(
  direction: WordsearchDirection,
  labels: {
    up: string;
    down: string;
    left: string;
    right: string;
    upLeft: string;
    upRight: string;
    downLeft: string;
    downRight: string;
  }
) {
  switch (direction) {
    case "up":
      return labels.up;
    case "down":
      return labels.down;
    case "left":
      return labels.left;
    case "right":
      return labels.right;
    case "up-left":
      return labels.upLeft;
    case "up-right":
      return labels.upRight;
    case "down-left":
      return labels.downLeft;
    case "down-right":
      return labels.downRight;
  }
}

export default function WordsearchPuzzle({
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
}: WordsearchPuzzleProps) {
  const t = getDictionary();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const stickyDockRef = useRef<HTMLDivElement | null>(null);
  const [selectionStart, setSelectionStart] = useState<WordsearchCell | null>(null);
  const [gestureState, setGestureState] = useState<GestureState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [puzzleError, setPuzzleError] = useState<string | null>(null);
  const [flashState, setFlashState] = useState<FlashState | null>(null);
  const [hintCountUsed, setHintCountUsed] = useState(initialMeta?.hintCountUsed ?? 0);
  const [startedAt, setStartedAt] = useState(initialMeta?.startedAt ?? Date.now());
  const [nowMs, setNowMs] = useState(Date.now());
  const [busyAction, setBusyAction] = useState<"evaluate" | "hint" | "submit" | null>(null);
  const [activeHintWordId, setActiveHintWordId] = useState<string | null>(
    initialMeta?.activeHintWordId ?? null
  );
  const [activeHintLevel, setActiveHintLevel] = useState<WordsearchHintLevel | null>(
    initialMeta?.activeHintLevel ?? null
  );
  const [activeHintStartCell, setActiveHintStartCell] = useState<WordsearchCell | null>(
    initialMeta?.activeHintStartCell ?? null
  );
  const [activeHintDirection, setActiveHintDirection] =
    useState<WordsearchDirection | null>(initialMeta?.activeHintDirection ?? null);
  const [activeHintCells, setActiveHintCells] = useState<WordsearchCell[] | null>(
    initialMeta?.activeHintCells ?? null
  );
  const [foundWordCellsById, setFoundWordCellsById] = useState<Record<string, WordsearchCell[]>>(
    () => cloneFoundWordCellsById(initialMeta?.foundWordCellsById)
  );
  const [completionState, setCompletionState] = useState<CompletionState | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [stickyDockHeight, setStickyDockHeight] = useState(0);

  const wordsById = useMemo(
    () => new Map(publicData.words.map((word) => [word.id, word] as const)),
    [publicData.words]
  );
  const gridRows = publicData.grid;
  const columnCount = gridRows[0]?.length ?? 0;
  const totalWordCount = publicData.words.length;
  const foundCount = value.foundWordIds.length;
  const allWordsFound = totalWordCount > 0 && foundCount === totalWordCount;
  const hintsRemaining = Math.max(assistanceHintLimit - hintCountUsed, 0);
  const resetKey = useMemo(
    () =>
      JSON.stringify({
        questAccessId,
        stepDocumentId,
        grid: publicData.grid,
        words: publicData.words.map((word) => word.id),
      }),
    [publicData.grid, publicData.words, questAccessId, stepDocumentId]
  );
  const previewCells = useMemo(() => {
    if (gestureState) {
      return buildWordsearchCellsBetween(gestureState.anchor, gestureState.current);
    }

    return selectionStart ? [selectionStart] : [];
  }, [gestureState, selectionStart]);
  const previewCellKeys = useMemo(
    () => new Set(previewCells.map((cell) => getCellKey(cell))),
    [previewCells]
  );
  const foundCellKeys = useMemo(
    () =>
      new Set(
        Object.values(foundWordCellsById)
          .flat()
          .map((cell) => getCellKey(cell))
      ),
    [foundWordCellsById]
  );
  const activeHintCellKeys = useMemo(() => {
    if (activeHintCells?.length) {
      return new Set(activeHintCells.map((cell) => getCellKey(cell)));
    }

    if (activeHintStartCell) {
      return new Set([getCellKey(activeHintStartCell)]);
    }

    return new Set<string>();
  }, [activeHintCells, activeHintStartCell]);
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        left: `${6 + ((index + 1) * 5.1) % 88}%`,
        delay: `${(index % 6) * 65}ms`,
        duration: `${960 + (index % 4) * 140}ms`,
        rotation: `${(index * 33) % 360}deg`,
        drift: `${-34 + ((index * 19) % 68)}px`,
        color: ["#3d8bfd", "#f59e0b", "#22c55e", "#ec4899", "#8b5cf6", "#ef4444"][
          index % 6
        ],
      })),
    []
  );

  useEffect(() => {
    onReadyChange(allWordsFound);
  }, [allWordsFound, onReadyChange]);

  useEffect(() => {
    setSelectionStart(null);
    setGestureState(null);
    setStatusMessage(null);
    setPuzzleError(null);
    setFlashState(null);
    setHintCountUsed(initialMeta?.hintCountUsed ?? 0);
    setStartedAt(initialMeta?.startedAt ?? Date.now());
    setNowMs(Date.now());
    setBusyAction(null);
    setActiveHintWordId(initialMeta?.activeHintWordId ?? null);
    setActiveHintLevel(initialMeta?.activeHintLevel ?? null);
    setActiveHintStartCell(cloneWordsearchCell(initialMeta?.activeHintStartCell) ?? null);
    setActiveHintDirection(initialMeta?.activeHintDirection ?? null);
    setActiveHintCells(cloneWordsearchCellList(initialMeta?.activeHintCells) ?? null);
    setFoundWordCellsById(cloneFoundWordCellsById(initialMeta?.foundWordCellsById));
    setCompletionState(null);
    setHelpOpen(false);
    setCelebrate(false);
  }, [resetKey]);

  useEffect(() => {
    if (!assistance) {
      return;
    }

    setHintCountUsed(assistance.hintUses);
    setActiveHintWordId(assistance.uiState?.activeHintWordId ?? null);
    setActiveHintLevel(null);
    setActiveHintStartCell(
      cloneWordsearchCell(assistance.uiState?.activeHintStartCell) ?? null
    );
    setActiveHintDirection(assistance.uiState?.activeHintDirection ?? null);
    setActiveHintCells(null);

    if (assistance.uiState?.foundWordCellsById) {
      setFoundWordCellsById((current) => ({
        ...current,
        ...cloneFoundWordCellsById(assistance.uiState?.foundWordCellsById),
      }));
    }
  }, [
    assistance,
    assistance?.hintUses,
    assistance?.uiState?.activeHintDirection,
    assistance?.uiState?.activeHintStartCell,
    assistance?.uiState?.activeHintWordId,
    assistance?.uiState?.foundWordCellsById,
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
    const nextMeta: WordsearchDraftMeta = {
      startedAt,
      hintCountUsed,
      activeHintWordId: activeHintWordId ?? undefined,
      activeHintLevel: activeHintLevel ?? undefined,
      activeHintStartCell: cloneWordsearchCell(activeHintStartCell),
      activeHintDirection: activeHintDirection ?? undefined,
      activeHintCells: cloneWordsearchCellList(activeHintCells),
      foundWordCellsById:
        Object.keys(foundWordCellsById).length > 0
          ? cloneFoundWordCellsById(foundWordCellsById)
          : undefined,
    };

    if (serializeWordsearchMeta(initialMeta) !== serializeWordsearchMeta(nextMeta)) {
      onDraftMetaChange(nextMeta);
    }
  }, [
    activeHintCells,
    activeHintDirection,
    activeHintLevel,
    activeHintStartCell,
    activeHintWordId,
    foundWordCellsById,
    hintCountUsed,
    initialMeta,
    onDraftMetaChange,
    startedAt,
  ]);

  useEffect(() => {
    if (!gestureState) {
      return;
    }

    const activeGesture = gestureState;

    function getCellFromPoint(clientX: number, clientY: number) {
      const element = document
        .elementFromPoint(clientX, clientY)
        ?.closest<HTMLElement>("[data-wordsearch-cell='true']");

      if (!element || !boardRef.current?.contains(element)) {
        return null;
      }

      const row = Number(element.dataset.row);
      const col = Number(element.dataset.col);

      if (!Number.isInteger(row) || !Number.isInteger(col)) {
        return null;
      }

      return { row, col } satisfies WordsearchCell;
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activeGesture.pointerId) {
        return;
      }

      const nextCell = getCellFromPoint(event.clientX, event.clientY);

      if (!nextCell) {
        return;
      }

      event.preventDefault();
      setGestureState((current) => {
        if (!current || current.pointerId !== event.pointerId) {
          return current;
        }

        if (areSameCell(current.current, nextCell)) {
          return current;
        }

        return {
          ...current,
          current: nextCell,
          moved: current.moved || !areSameCell(current.anchor, nextCell),
        };
      });
    }

    function finalizeGesture(clientX: number, clientY: number) {
      const releasedCell = getCellFromPoint(clientX, clientY) ?? activeGesture.current;
      const moved =
        activeGesture.moved || !areSameCell(activeGesture.anchor, releasedCell);

      setGestureState(null);

      if (moved) {
        setSelectionStart(null);
        void handleSelection(activeGesture.anchor, releasedCell);
        return;
      }

      if (selectionStart && !areSameCell(selectionStart, releasedCell)) {
        const firstCell = selectionStart;
        setSelectionStart(null);
        void handleSelection(firstCell, releasedCell);
        return;
      }

      if (selectionStart && areSameCell(selectionStart, releasedCell)) {
        setSelectionStart(null);
        setStatusMessage(null);
        return;
      }

      setSelectionStart(releasedCell);
      setStatusMessage(t.step.wordsearchSelectEnd);
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerId !== activeGesture.pointerId) {
        return;
      }

      event.preventDefault();
      finalizeGesture(event.clientX, event.clientY);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, { passive: false });
    window.addEventListener("pointercancel", handlePointerUp, { passive: false });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [gestureState, selectionStart, t.step.wordsearchSelectEnd]);

  function showFlash(nextFlash: FlashState) {
    setFlashState(nextFlash);

    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }

    flashTimerRef.current = window.setTimeout(() => {
      setFlashState(null);
    }, 1400);
  }

  function replaceFoundWordIds(nextFoundWordIds: string[]) {
    const uniqueIds = Array.from(
      new Set(nextFoundWordIds.map((entry) => entry.trim()).filter((entry) => entry.length > 0))
    );

    if (JSON.stringify(uniqueIds) === JSON.stringify(value.foundWordIds)) {
      return;
    }

    onChange({
      type: "wordsearch",
      foundWordIds: uniqueIds,
    });
  }

  async function requestSelectionEvaluation(start: WordsearchCell, end: WordsearchCell) {
    const response = await fetch("/api/steps/wordsearch/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        questAccessId,
        stepDocumentId,
        foundWordIds: value.foundWordIds,
        startRow: start.row,
        startCol: start.col,
        endRow: end.row,
        endCol: end.col,
      }),
    });
    const data = (await response.json()) as EvaluateResponse;

    if (!response.ok || !data.ok || !data.evaluation) {
      throw new Error(data.error ?? t.step.genericError);
    }

    return data.evaluation;
  }

  async function handleSelection(start: WordsearchCell, end: WordsearchCell) {
    const candidateCells = buildWordsearchCellsBetween(start, end);

    if (candidateCells.length === 0) {
      setStatusMessage(t.step.wordsearchInvalidSelection);
      showFlash({
        variant: "error",
        message: t.step.wordsearchInvalidSelection,
      });
      return;
    }

    setBusyAction("evaluate");
    setPuzzleError(null);
    setStatusMessage(null);

    try {
      const evaluation = await requestSelectionEvaluation(start, end);

      if (!evaluation.match || !evaluation.wordId) {
        setStatusMessage(t.step.wordsearchInvalidSelection);
        showFlash({
          variant: "error",
          message: t.step.wordsearchInvalidSelection,
        });
        return;
      }

      if (evaluation.alreadyFound) {
        setStatusMessage(t.step.wordsearchAlreadyFound);
        showFlash({
          variant: "info",
          message: t.step.wordsearchAlreadyFound,
        });
        return;
      }

      const nextFoundWordIds = [...value.foundWordIds, evaluation.wordId];
      const foundWord = wordsById.get(evaluation.wordId);
      replaceFoundWordIds(nextFoundWordIds);
      setFoundWordCellsById((current) => ({
        ...current,
        [evaluation.wordId as string]: cloneWordsearchCellList(evaluation.cells) ?? [],
      }));

      if (activeHintWordId === evaluation.wordId) {
        setActiveHintWordId(null);
        setActiveHintLevel(null);
        setActiveHintStartCell(null);
        setActiveHintDirection(null);
        setActiveHintCells(null);
      }

      const foundMessage = t.step.wordsearchFound.replace(
        "{word}",
        foundWord?.label ?? evaluation.wordId
      );
      setStatusMessage(foundMessage);
      showFlash({
        variant: "success",
        message: foundMessage,
      });

      if (evaluation.solved) {
        const nextSubmission: WordsearchSubmission = {
          type: "wordsearch",
          foundWordIds: nextFoundWordIds,
        };

        setStatusMessage(t.step.wordsearchReadyToValidate);
        const result = await handleSolve(nextSubmission);

        if (!result) {
          setStatusMessage(t.step.wordsearchReadyToValidate);
        }
      }
    } catch (error) {
      setPuzzleError(error instanceof Error ? error.message : t.step.genericError);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSolve(nextSubmission: WordsearchSubmission = value) {
    setBusyAction("submit");
    setPuzzleError(null);

    try {
      const durationMs = Math.max(Date.now() - startedAt, 0);
      const result = await onRequestSolve(nextSubmission, {
        durationMs,
        hintCountUsed,
        foundCount: nextSubmission.foundWordIds.length,
      });

      if (!result) {
        return null;
      }

      setCompletionState({
        questCompleted: result.questCompleted,
        durationMs: result.stats.durationMs,
        hintCountUsed: result.stats.hintCountUsed,
        foundCount: result.stats.foundCount,
      });
      setNowMs(Date.now());
      setCelebrate(false);
      requestAnimationFrame(() => {
        setCelebrate(true);
      });
      setStatusMessage(null);
      return result;
    } finally {
      setBusyAction(null);
    }
  }

  function handleReset() {
    replaceFoundWordIds([]);
    setSelectionStart(null);
    setGestureState(null);
    setStatusMessage(null);
    setPuzzleError(null);
    setFlashState(null);
    setHintCountUsed(assistance?.hintUses ?? 0);
    setStartedAt(Date.now());
    setNowMs(Date.now());
    setBusyAction(null);
    setActiveHintWordId(assistance?.uiState?.activeHintWordId ?? null);
    setActiveHintLevel(null);
    setActiveHintStartCell(
      cloneWordsearchCell(assistance?.uiState?.activeHintStartCell) ?? null
    );
    setActiveHintDirection(assistance?.uiState?.activeHintDirection ?? null);
    setActiveHintCells(null);
    setFoundWordCellsById(
      cloneFoundWordCellsById(assistance?.uiState?.foundWordCellsById)
    );
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
                key={`wordsearch-confetti-${piece.id}`}
                className="wordsearch-confetti"
                style={
                  {
                    left: piece.left,
                    animationDelay: piece.delay,
                    animationDuration: piece.duration,
                    backgroundColor: piece.color,
                    ["--wordsearch-confetti-rotate" as "--wordsearch-confetti-rotate"]:
                      piece.rotation,
                    ["--wordsearch-confetti-drift" as "--wordsearch-confetti-drift"]:
                      piece.drift,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ) : null}

        <div className={celebrate ? "wordsearch-finish-card wordsearch-finish-card-active" : "wordsearch-finish-card"}>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {t.step.wordsearchCompletionEyebrow}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{title}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            {t.step.wordsearchCompletionTitle}
          </h2>
          <p className="mt-4 whitespace-pre-line text-base leading-7 text-card-foreground">
            {successText ||
              (completionState.questCompleted
                ? t.step.successCompletedBody
                : t.step.successDefaultBody)}
          </p>

          <dl className="mt-6 grid gap-3 rounded-2xl border border-border bg-background/70 p-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">{t.step.wordsearchStatTime}</dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatDuration(completionState.durationMs)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t.step.wordsearchStatHints}</dt>
              <dd className="mt-1 text-xl font-semibold">
                {completionState.hintCountUsed}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t.step.wordsearchStatWords}</dt>
              <dd className="mt-1 text-xl font-semibold">{completionState.foundCount}</dd>
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
          .wordsearch-finish-card {
            transform-origin: center top;
          }

          .wordsearch-finish-card-active {
            animation: wordsearch-board-settle 520ms ease-out forwards;
          }

          .wordsearch-confetti {
            position: absolute;
            top: -8%;
            width: 0.7rem;
            height: 1.2rem;
            border-radius: 999px;
            opacity: 0;
            animation: wordsearch-confetti-fall ease-out forwards;
            transform: rotate(var(--wordsearch-confetti-rotate));
          }

          @keyframes wordsearch-board-settle {
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

          @keyframes wordsearch-confetti-fall {
            0% {
              opacity: 0;
              transform: translate3d(0, -14px, 0) rotate(0deg);
            }

            14% {
              opacity: 1;
            }

            100% {
              opacity: 0;
              transform: translate3d(var(--wordsearch-confetti-drift, 0), 240px, 0)
                rotate(calc(var(--wordsearch-confetti-rotate, 0deg) + 320deg));
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
                {t.step.wordsearchHelpTitle}
              </p>
              <p className="whitespace-pre-line text-base leading-7 text-card-foreground">
                {publicData.helpText || t.step.wordsearchHelpDefaultBody}
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="inline-flex rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
              >
                {t.step.wordsearchHelpClose}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative space-y-4">
        {flashState ? (
          <div className="pointer-events-none absolute inset-x-0 -top-3 z-20 flex justify-center px-3">
            <div
              className={[
                "wordsearch-flash w-full max-w-md rounded-2xl border px-4 py-3 text-center text-sm font-medium shadow-2xl",
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
          <div
            ref={boardRef}
            className="mx-auto w-full max-w-[34rem] touch-none rounded-[1.75rem] border border-border bg-background/70 p-2 sm:p-3"
            style={{
              touchAction: "none",
            }}
          >
            <div
              className="grid gap-1 sm:gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${Math.max(columnCount, 1)}, minmax(0, 1fr))`,
              }}
            >
              {gridRows.map((row, rowIndex) =>
                row.split("").map((letter, colIndex) => {
                  const cell = { row: rowIndex, col: colIndex } satisfies WordsearchCell;
                  const cellKey = getCellKey(cell);
                  const isPreview = previewCellKeys.has(cellKey);
                  const isFound = foundCellKeys.has(cellKey);
                  const isHinted = activeHintCellKeys.has(cellKey);

                  return (
                    <button
                      key={cellKey}
                      type="button"
                      data-wordsearch-cell="true"
                      data-row={rowIndex}
                      data-col={colIndex}
                      disabled={busyAction !== null}
                      onPointerDown={(event) => {
                        if (completionState) {
                          return;
                        }

                        event.preventDefault();
                        setStatusMessage(null);
                        setPuzzleError(null);
                        setGestureState({
                          anchor: cell,
                          current: cell,
                          moved: false,
                          pointerId: event.pointerId,
                        });
                      }}
                      className={[
                        "aspect-square min-w-0 rounded-xl border text-center text-sm font-semibold uppercase transition sm:text-base",
                        isFound
                          ? "border-emerald-400/60 bg-emerald-500/18 text-emerald-100 shadow-[0_0_0_1px_rgba(74,222,128,0.12)]"
                          : "border-border bg-card text-card-foreground",
                        isHinted && !isFound
                          ? "border-amber-300/80 bg-amber-300/90 text-slate-950 shadow-[0_0_0_1px_rgba(252,211,77,0.16)]"
                          : "",
                        isPreview
                          ? "border-primary bg-primary/18 text-primary shadow-[0_0_0_1px_rgba(61,139,253,0.14)]"
                          : "",
                      ].join(" ")}
                    >
                      {letter}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {selectionStart
            ? t.step.wordsearchSelectEnd
            : t.step.wordsearchSelectInstruction}
        </p>
      </div>

      <div className="grid gap-3">
        {publicData.words.map((word) => {
          const isFound = value.foundWordIds.includes(word.id);
          const isHinted = activeHintWordId === word.id && !isFound;

          return (
            <div
              key={word.id}
              className={[
                "rounded-2xl border px-4 py-3 transition",
                isFound
                  ? "border-emerald-400/50 bg-emerald-500/10"
                  : isHinted
                    ? "border-amber-300/70 bg-amber-200/80 shadow-[0_0_0_1px_rgba(252,211,77,0.12)]"
                    : "border-border bg-card/70",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-semibold text-card-foreground">{word.label}</p>
                <span
                  className={[
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    isFound
                      ? "bg-emerald-500/15 text-emerald-100"
                      : isHinted
                        ? "bg-amber-300/90 text-slate-950 shadow-[0_0_0_1px_rgba(252,211,77,0.12)]"
                        : "bg-background/80 text-muted-foreground",
                  ].join(" ")}
                >
                  {isFound
                    ? t.step.wordsearchFound.replace("{word}", word.label)
                    : word.clue
                      ? `${t.step.wordsearchClueLabel} : ${word.clue}`
                      : t.step.wordsearchProgressLabel
                          .replace("{found}", String(foundCount))
                          .replace("{total}", String(totalWordCount))}
                </span>
              </div>
              {word.clue ? (
                <p className="mt-2 text-sm text-muted-foreground">{word.clue}</p>
              ) : null}
            </div>
          );
        })}
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
              <dt>{t.step.wordsearchStatTime}</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">
                {formatDuration(nowMs - startedAt)}
              </dd>
            </div>
            <div>
              <dt>{t.step.wordsearchStatWords}</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">
                {t.step.wordsearchProgressLabel
                  .replace("{found}", String(foundCount))
                  .replace("{total}", String(totalWordCount))}
              </dd>
            </div>
            <div>
              <dt>{t.step.wordsearchStatHints}</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">
                {t.step.wordsearchHintsRemaining.replace(
                  "{count}",
                  String(hintsRemaining)
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            disabled={busyAction !== null}
            className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-card-foreground transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.step.wordsearchHelpButton}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={busyAction !== null}
            className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-card-foreground transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.step.wordsearchResetButton}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSolve();
            }}
            disabled={busyAction !== null || !allWordsFound}
            className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === "submit"
              ? t.step.wordsearchValidating
              : t.step.wordsearchValidateButton}
          </button>
        </div>
      </div>

      <style>{`
        .wordsearch-flash {
          animation: wordsearch-flash-fade 1.4s ease-out forwards;
        }

        @keyframes wordsearch-flash-fade {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }

          16%,
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
