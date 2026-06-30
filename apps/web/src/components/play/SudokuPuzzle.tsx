"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getDictionary } from "@/lib/i18n";
import type { SudokuDraftMeta } from "@/lib/offline/questDrafts";
import {
  cloneSudokuGrid,
  findSudokuConflictCells,
  isSudokuClueCell,
  isSudokuGridComplete,
  type SudokuCell,
  type SudokuEvaluation,
  type SudokuPuzzlePublicData,
  type SudokuSubmission,
} from "@/lib/quests/puzzleTypes";

type SudokuPuzzleProps = {
  questAccessId: string;
  stepDocumentId: string;
  publicData: SudokuPuzzlePublicData;
  value: SudokuSubmission;
  onChange: (next: SudokuSubmission) => void;
  onReadyChange: (ready: boolean) => void;
  initialMeta?: SudokuDraftMeta | null;
  title: string;
  successText?: string;
  onDraftMetaChange: (next: SudokuDraftMeta | null) => void;
  onRequestSolve: (
    nextSubmission: SudokuSubmission,
    stats: { durationMs: number; checkCount: number; solveCount: number }
  ) => Promise<{ questCompleted: boolean; stats: { durationMs: number; checkCount: number; solveCount: number } } | null>;
  onContinueAfterComplete: (questCompleted: boolean) => void;
};

type EvaluateResponse = {
  ok?: boolean;
  evaluation?: SudokuEvaluation;
  error?: string;
};

type CompletionState = {
  questCompleted: boolean;
  durationMs: number;
  checkCount: number;
  solveCount: number;
};

function getCellKey(row: number, column: number) {
  return `${row}:${column}`;
}

function getEmptyCells(grid: number[][]): SudokuCell[] {
  const cells: SudokuCell[] = [];

  for (let row = 0; row < grid.length; row += 1) {
    for (let column = 0; column < grid[row].length; column += 1) {
      if (Number(grid[row][column]) === 0) {
        cells.push({ row, column });
      }
    }
  }

  return cells;
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

function isSameDraftMeta(
  left: SudokuDraftMeta | null | undefined,
  right: SudokuDraftMeta | null | undefined
) {
  return (
    (left?.startedAt ?? undefined) === (right?.startedAt ?? undefined) &&
    (left?.checkCount ?? undefined) === (right?.checkCount ?? undefined) &&
    (left?.solveCount ?? undefined) === (right?.solveCount ?? undefined)
  );
}

export default function SudokuPuzzle({
  questAccessId,
  stepDocumentId,
  publicData,
  value,
  onChange,
  onReadyChange,
  initialMeta,
  title,
  successText,
  onDraftMetaChange,
  onRequestSolve,
  onContinueAfterComplete,
}: SudokuPuzzleProps) {
  const t = getDictionary();
  const [selectedCell, setSelectedCell] = useState<{ row: number; column: number } | null>(
    null
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [puzzleError, setPuzzleError] = useState<string | null>(null);
  const [checkFlashVisible, setCheckFlashVisible] = useState(false);
  const [errorCellKeys, setErrorCellKeys] = useState<string[]>([]);
  const [checkCount, setCheckCount] = useState(initialMeta?.checkCount ?? 0);
  const [solveCount, setSolveCount] = useState(initialMeta?.solveCount ?? 0);
  const [startedAt, setStartedAt] = useState(initialMeta?.startedAt ?? Date.now());
  const [nowMs, setNowMs] = useState(Date.now());
  const [busyAction, setBusyAction] = useState<"check" | "solve" | null>(null);
  const [completionState, setCompletionState] = useState<CompletionState | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [stickyDockHeight, setStickyDockHeight] = useState(0);
  const initialGridKey = useMemo(
    () => JSON.stringify(publicData.initialGrid),
    [publicData.initialGrid]
  );
  const stepResetKey = useMemo(
    () => `${questAccessId}:${stepDocumentId}:${initialGridKey}`,
    [initialGridKey, questAccessId, stepDocumentId]
  );
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickyDockRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onReadyChange(isSudokuGridComplete(value.grid));
  }, [onReadyChange, value.grid]);

  useEffect(() => {
    setSelectedCell(null);
    setStatusMessage(null);
    setPuzzleError(null);
    setErrorCellKeys([]);
    setCompletionState(null);
    setCelebrate(false);
    setCheckCount(initialMeta?.checkCount ?? 0);
    setSolveCount(initialMeta?.solveCount ?? 0);
    setStartedAt(initialMeta?.startedAt ?? Date.now());
    setNowMs(Date.now());
  }, [stepResetKey]);

  useEffect(() => {
    const nextMeta = {
      startedAt,
      checkCount,
      solveCount,
    };

    if (!isSameDraftMeta(initialMeta, nextMeta)) {
      onDraftMetaChange(nextMeta);
    }
  }, [checkCount, initialMeta, onDraftMetaChange, solveCount, startedAt]);

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
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
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

  const conflictKeys = useMemo(
    () =>
      new Set(
        findSudokuConflictCells(value.grid).map((cell) => getCellKey(cell.row, cell.column))
      ),
    [value.grid]
  );
  const displayedErrorKeys = useMemo(
    () => new Set(errorCellKeys),
    [errorCellKeys]
  );
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const base = index + 1;
        return {
          id: index,
          left: `${5 + ((base * 17) % 90)}%`,
          delay: `${(index % 6) * 70}ms`,
          duration: `${900 + (index % 5) * 140}ms`,
          rotation: `${(base * 37) % 360}deg`,
          xDrift: `${-30 + ((base * 19) % 60)}px`,
          color:
            ["#1f4e79", "#3d8bfd", "#f4b942", "#66bb6a", "#ef5350", "#7e57c2"][
              index % 6
            ],
        };
      }),
    []
  );

  function updateCell(nextValue: number) {
    if (!selectedCell || completionState) {
      return;
    }

    const { row, column } = selectedCell;

    if (isSudokuClueCell(publicData.initialGrid, row, column)) {
      return;
    }

    const nextGrid = cloneSudokuGrid(value.grid);
    nextGrid[row][column] = nextValue;
    onChange({
      type: "sudoku",
      grid: nextGrid,
    });
    setPuzzleError(null);
    setStatusMessage(null);
    setCheckFlashVisible(false);
    setErrorCellKeys([]);
  }

  function resetGrid() {
    onChange({
      type: "sudoku",
      grid: cloneSudokuGrid(publicData.initialGrid),
    });
    setSelectedCell(null);
    setStatusMessage(null);
    setPuzzleError(null);
    setErrorCellKeys([]);
    setCheckFlashVisible(false);
    setCheckCount(0);
    setSolveCount(0);
    setStartedAt(Date.now());
    setNowMs(Date.now());
    setCompletionState(null);
    setCelebrate(false);
  }

  async function requestEvaluation() {
    const response = await fetch("/api/steps/sudoku/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        questAccessId,
        stepDocumentId,
        grid: value.grid,
      }),
    });

    const data = (await response.json()) as EvaluateResponse;

    if (!response.ok || !data.ok || !data.evaluation) {
      throw new Error(data.error ?? t.step.sudokuEvaluationError);
    }

    return data.evaluation;
  }

  function showPositiveCheckFlash() {
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }

    setCheckFlashVisible(true);
    flashTimeoutRef.current = setTimeout(() => {
      setCheckFlashVisible(false);
    }, 1100);
  }

  async function handleCheck() {
    setBusyAction("check");
    setPuzzleError(null);
    setStatusMessage(null);
    const nextCheckCount = checkCount + 1;
    setCheckCount(nextCheckCount);

    try {
      const evaluation = await requestEvaluation();
      const nextErrorKeys = evaluation.errorCells.map((cell) => getCellKey(cell.row, cell.column));
      setErrorCellKeys(nextErrorKeys);

      if (nextErrorKeys.length === 0) {
        showPositiveCheckFlash();
        setStatusMessage(t.step.sudokuCheckSuccess);
      } else {
        setStatusMessage(t.step.sudokuCheckErrors);
      }
    } catch (error) {
      setPuzzleError(error instanceof Error ? error.message : t.step.sudokuEvaluationError);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSolve() {
    setBusyAction("solve");
    setPuzzleError(null);
    setCheckFlashVisible(false);
    setStatusMessage(null);
    const nextSolveCount = solveCount + 1;
    setSolveCount(nextSolveCount);

    try {
      const evaluation = await requestEvaluation();
      const emptyCells = getEmptyCells(value.grid);
      const emptyKeys = emptyCells.map((cell) => getCellKey(cell.row, cell.column));
      const nextErrorKeys = Array.from(
        new Set([
          ...evaluation.errorCells.map((cell) => getCellKey(cell.row, cell.column)),
          ...(!evaluation.complete ? emptyKeys : []),
        ])
      );

      setErrorCellKeys(nextErrorKeys);

      if (!evaluation.solved) {
        setStatusMessage(
          evaluation.complete ? t.step.sudokuSolveErrors : t.step.sudokuSolveIncomplete
        );
        return;
      }

      const durationMs = Math.max(Date.now() - startedAt, 0);
      const result = await onRequestSolve(value, {
        durationMs,
        checkCount,
        solveCount: nextSolveCount,
      });

      if (!result) {
        return;
      }

      setCompletionState({
        questCompleted: result.questCompleted,
        durationMs,
        checkCount,
        solveCount: nextSolveCount,
      });
      setNowMs(Date.now());
      setCelebrate(false);
      requestAnimationFrame(() => {
        setCelebrate(true);
      });
      setStatusMessage(null);
      setErrorCellKeys([]);
    } catch (error) {
      setPuzzleError(error instanceof Error ? error.message : t.step.sudokuEvaluationError);
    } finally {
      setBusyAction(null);
    }
  }

  function renderGrid(uniform = false) {
    return (
      <div
        className={[
          "grid grid-cols-9 gap-0.5 rounded-xl border border-border bg-background p-1.5 transition-all duration-500 sm:gap-1 sm:p-2",
          completionState
            ? celebrate
              ? "sudoku-grid-finish sudoku-grid-celebrate"
              : "sudoku-grid-finish"
            : "",
          uniform ? "bg-primary/[0.06]" : "",
        ].join(" ")}
      >
        {value.grid.map((row, rowIndex) =>
          row.map((cell, columnIndex) => {
            const isSelected =
              selectedCell?.row === rowIndex &&
              selectedCell?.column === columnIndex;
            const isClue = isSudokuClueCell(
              publicData.initialGrid,
              rowIndex,
              columnIndex
            );
            const cellKey = getCellKey(rowIndex, columnIndex);
            const hasError = displayedErrorKeys.has(cellKey);
            const hasConflict = conflictKeys.has(cellKey);
            const borderClasses = [
              rowIndex % 3 === 0 ? "border-t-2" : "border-t",
              columnIndex % 3 === 0 ? "border-l-2" : "border-l",
              rowIndex === 8 ? "border-b-2" : "border-b",
              columnIndex === 8 ? "border-r-2" : "border-r",
            ].join(" ");

            return (
              <button
                key={cellKey}
                type="button"
                onClick={() =>
                  !completionState &&
                  setSelectedCell({ row: rowIndex, column: columnIndex })
                }
                className={[
                  "aspect-square w-full rounded-[0.45rem] text-center text-[0.95rem] font-semibold leading-none transition sm:rounded-sm sm:text-base",
                  borderClasses,
                  completionState
                    ? "cursor-default border-primary/20 bg-primary/[0.08] text-foreground"
                    : isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground",
                  isClue ? "font-extrabold" : "font-medium",
                  hasError ? "sudoku-cell-error border-destructive bg-destructive/10 text-destructive" : "",
                  hasConflict && !hasError ? "sudoku-cell-conflict" : "",
                ].join(" ")}
              >
                {cell > 0 ? cell : ""}
              </button>
            );
          })
        )}
      </div>
    );
  }

  if (completionState) {
    return (
      <div className="relative space-y-6 overflow-hidden rounded-2xl border border-border bg-background/70 p-5">
        {celebrate ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {confettiPieces.map((piece) => (
              <span
                key={piece.id}
                className="sudoku-confetti"
                style={
                  {
                    left: piece.left,
                    animationDelay: piece.delay,
                    animationDuration: piece.duration,
                    backgroundColor: piece.color,
                    ["--x-drift" as "--x-drift"]: piece.xDrift,
                    ["--piece-rotation" as "--piece-rotation"]: piece.rotation,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ) : null}

        <div className="relative z-10 space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {t.step.sudokuCompletionEyebrow}
          </p>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t.step.sudokuCompletionTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-base text-card-foreground">
              {successText || t.step.successDefaultBody}
            </p>
          </div>

          <div className="mx-auto max-w-sm">{renderGrid(true)}</div>

          <dl className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 text-sm text-card-foreground sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t.step.sudokuStatTime}</dt>
              <dd className="mt-1 text-lg font-semibold">
                {formatDuration(completionState.durationMs)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.step.sudokuStatChecks}</dt>
              <dd className="mt-1 text-lg font-semibold">{completionState.checkCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.step.sudokuStatSolves}</dt>
              <dd className="mt-1 text-lg font-semibold">{completionState.solveCount}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onContinueAfterComplete(completionState.questCompleted)}
              className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-[var(--color-primary-hover)]"
            >
              {completionState.questCompleted
                ? t.step.successQuestComplete
                : t.step.successContinue}
            </button>
          </div>
        </div>

        <style>{`
          .sudoku-grid-finish {
            transform: scale(0.96) translateY(6px);
            opacity: 0.96;
          }

          .sudoku-grid-celebrate {
            animation: sudoku-grid-settle 520ms ease-out forwards;
          }

          .sudoku-cell-error {
            animation: sudoku-cell-pulse 360ms ease-out;
          }

          .sudoku-cell-conflict {
            box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.25);
          }

          .sudoku-confetti {
            position: absolute;
            top: -8%;
            width: 10px;
            height: 16px;
            border-radius: 2px;
            opacity: 0;
            animation-name: sudoku-confetti-fall;
            animation-timing-function: ease-out;
            animation-fill-mode: forwards;
          }

          @keyframes sudoku-grid-settle {
            0% {
              transform: scale(0.96) translateY(8px);
            }
            65% {
              transform: scale(0.9) translateY(2px);
            }
            100% {
              transform: scale(0.92) translateY(0);
            }
          }

          @keyframes sudoku-cell-pulse {
            0% {
              transform: scale(1);
            }
            40% {
              transform: scale(1.06);
            }
            100% {
              transform: scale(1);
            }
          }

          @keyframes sudoku-confetti-fall {
            0% {
              opacity: 0;
              transform: translate3d(0, 0, 0) rotate(var(--piece-rotation, 0deg));
            }
            10% {
              opacity: 1;
            }
            100% {
              opacity: 0;
              transform: translate3d(var(--x-drift, 0), 280px, 0)
                rotate(calc(var(--piece-rotation, 0deg) + 360deg));
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
      <div className="space-y-3">
        <div className="relative">
          <div
            className={[
              "rounded-xl transition-all duration-300",
              checkFlashVisible
                ? "ring-4 ring-emerald-300/80 shadow-[0_0_0_8px_rgba(34,197,94,0.12)]"
                : "",
            ].join(" ")}
          >
            {renderGrid()}
          </div>

          {checkFlashVisible ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
              <div className="sudoku-check-flash flex flex-col items-center gap-2 rounded-2xl border border-emerald-200/70 bg-emerald-500/92 px-5 py-4 text-white shadow-2xl">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/18">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 8.5 6.2 11.5 13 4.5" />
                  </svg>
                </span>
                <span className="text-base font-semibold">
                  {t.step.sudokuCheckSuccessShort}
                </span>
                <span className="text-center text-sm text-white/90">
                  {t.step.sudokuCheckSuccess}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          {selectedCell
            ? t.step.sudokuSelectedCell
            : t.step.sudokuSelectCell}
        </p>
      </div>

      {statusMessage ? (
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        </div>
      ) : null}
      {puzzleError ? <p className="text-sm text-destructive">{puzzleError}</p> : null}

      <div
        ref={stickyDockRef}
        className="sticky bottom-3 z-20 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/85"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
        }}
      >
        <div className="mb-3 rounded-xl border border-border bg-background/60 p-3">
          <dl className="grid grid-cols-3 gap-3 text-xs text-muted-foreground sm:text-sm">
            <div>
              <dt>{t.step.sudokuStatTime}</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">
                {formatDuration(nowMs - startedAt)}
              </dd>
            </div>
            <div>
              <dt>{t.step.sudokuStatChecks}</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">{checkCount}</dd>
            </div>
            <div>
              <dt>{t.step.sudokuStatSolves}</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">{solveCount}</dd>
            </div>
          </dl>
        </div>

        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {Array.from({ length: 9 }, (_, index) => index + 1).map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => updateCell(digit)}
              disabled={!selectedCell || busyAction !== null}
              className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background text-base font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={() => updateCell(0)}
            disabled={!selectedCell || busyAction !== null}
            className="col-span-2 inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t.step.sudokuClearCell}
          </button>

          <button
            type="button"
            onClick={resetGrid}
            disabled={busyAction !== null}
            className="col-span-3 inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t.step.sudokuResetGrid}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              void handleCheck();
            }}
            disabled={busyAction !== null}
            className="inline-flex rounded-md border border-border bg-background px-4 py-2 text-foreground hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === "check" ? t.step.sudokuChecking : t.step.sudokuCheckButton}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSolve();
            }}
            disabled={busyAction !== null}
            className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === "solve" ? t.step.sudokuSolving : t.step.sudokuSolveButton}
          </button>
        </div>
      </div>

      <style>{`
        .sudoku-check-flash {
          animation: sudoku-check-fade 1.1s ease-out forwards;
        }

        @keyframes sudoku-check-fade {
          0% {
            opacity: 0;
            transform: translateY(6px) scale(0.9);
          }
          20% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-10px) scale(1.04);
          }
        }
      `}</style>
    </div>
  );
}
