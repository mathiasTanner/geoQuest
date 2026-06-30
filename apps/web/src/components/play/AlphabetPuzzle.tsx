"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getDictionary } from "@/lib/i18n";
import {
  getAlphabetSymbolsInOrder,
  tokenizeAlphabetLine,
  type AlphabetEvaluation,
  type AlphabetPuzzlePublicData,
  type AlphabetSubmission,
} from "@/lib/quests/puzzleTypes";

type AlphabetPuzzleProps = {
  questAccessId: string;
  stepDocumentId: string;
  publicData: AlphabetPuzzlePublicData;
  value: AlphabetSubmission;
  onChange: (next: AlphabetSubmission) => void;
  onReadyChange: (ready: boolean) => void;
  title: string;
  successText?: string;
  onRequestSolve: (
    nextSubmission: AlphabetSubmission,
    stats: { durationMs: number; checkCount: number; solveCount: number }
  ) => Promise<{ questCompleted: boolean; stats: { durationMs: number; checkCount: number; solveCount: number } } | null>;
  onContinueAfterComplete: (questCompleted: boolean) => void;
};

type EvaluateResponse = {
  ok?: boolean;
  evaluation?: AlphabetEvaluation;
  error?: string;
};

type CompletionState = {
  questCompleted: boolean;
  durationMs: number;
  checkCount: number;
  solveCount: number;
};

function formatDuration(totalMs: number) {
  const totalSeconds = Math.max(Math.round(totalMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function isSameAssignments(
  left: Record<string, string>,
  right: Record<string, string>
) {
  const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey, "fr-CH")
  );
  const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey, "fr-CH")
  );

  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function shuffleLetters(letters: string[], seedSource: string) {
  let seed = 0;

  for (const character of seedSource) {
    seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  }

  const ranked = [...letters].map((letter, index) => {
    const nextSeed = (seed + (index + 1) * 2654435761) >>> 0;
    return {
      letter,
      score: Math.sin(nextSeed) * 10000,
    };
  });

  return ranked
    .sort((left, right) => left.score - right.score)
    .map((entry) => entry.letter);
}

export default function AlphabetPuzzle({
  questAccessId,
  stepDocumentId,
  publicData,
  value,
  onChange,
  onReadyChange,
  title,
  successText,
  onRequestSolve,
  onContinueAfterComplete,
}: AlphabetPuzzleProps) {
  const t = getDictionary();
  const lines = useMemo(
    () => publicData.lines.map((line) => tokenizeAlphabetLine(line)),
    [publicData.lines]
  );
  const symbolOrder = useMemo(
    () => getAlphabetSymbolsInOrder(publicData.lines),
    [publicData.lines]
  );
  const shuffledLetters = useMemo(
    () => shuffleLetters(publicData.letterBank, `${stepDocumentId}:${publicData.lines.join("|")}`),
    [publicData.letterBank, publicData.lines, stepDocumentId]
  );
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [eraseMode, setEraseMode] = useState(false);
  const [focusedSymbol, setFocusedSymbol] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, string>[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [puzzleError, setPuzzleError] = useState<string | null>(null);
  const [wrongSymbols, setWrongSymbols] = useState<string[]>([]);
  const [checkFlashVariant, setCheckFlashVariant] = useState<"success" | "error" | null>(null);
  const [checkCount, setCheckCount] = useState(0);
  const [solveCount, setSolveCount] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [nowMs, setNowMs] = useState(Date.now());
  const [busyAction, setBusyAction] = useState<"check" | "solve" | null>(null);
  const [completionState, setCompletionState] = useState<CompletionState | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [stickyDockHeight, setStickyDockHeight] = useState(0);
  const flashTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const stickyDockRef = useRef<HTMLDivElement | null>(null);
  const durationMs = Math.max(nowMs - startedAt, 0);
  const filledSymbolCount = symbolOrder.filter(
    (symbol) => typeof value.assignments[symbol] === "string"
  ).length;
  const progressPercent =
    symbolOrder.length > 0
      ? Math.round((filledSymbolCount / symbolOrder.length) * 100)
      : 0;
  const usedLetters = useMemo(
    () =>
      Object.entries(value.assignments).reduce<Record<string, string>>((accumulator, [symbol, letter]) => {
        accumulator[letter] = symbol;
        return accumulator;
      }, {}),
    [value.assignments]
  );

  useEffect(() => {
    setSelectedLetter(null);
    setEraseMode(false);
    setFocusedSymbol(null);
    setHistory([]);
    setStatusMessage(null);
    setPuzzleError(null);
    setWrongSymbols([]);
    setCheckFlashVariant(null);
    setCheckCount(0);
    setSolveCount(0);
    setStartedAt(Date.now());
    setNowMs(Date.now());
    setBusyAction(null);
    setCompletionState(null);
    setHelpOpen(false);
    setCelebrate(false);
  }, [stepDocumentId]);

  useEffect(() => {
    onReadyChange(filledSymbolCount === symbolOrder.length && symbolOrder.length > 0);
  }, [filledSymbolCount, onReadyChange, symbolOrder.length]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current);
      }

      if (completionTimerRef.current) {
        window.clearTimeout(completionTimerRef.current);
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

  function replaceAssignments(nextAssignments: Record<string, string>) {
    if (isSameAssignments(value.assignments, nextAssignments)) {
      return;
    }

    onChange({
      type: "alphabet",
      assignments: nextAssignments,
    });
  }

  function pushHistorySnapshot() {
    setHistory((current) => [...current.slice(-29), { ...value.assignments }]);
  }

  function showCheckFlash(variant: "success" | "error") {
    setCheckFlashVariant(variant);

    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }

    flashTimerRef.current = window.setTimeout(() => {
      setCheckFlashVariant(null);
    }, 1100);
  }

  function applyLetterToSymbol(symbol: string, letter: string) {
    const assignedSymbol = usedLetters[letter];
    const currentLetter = value.assignments[symbol];

    if (assignedSymbol && assignedSymbol !== symbol) {
      setPuzzleError(t.step.alphabetLetterInUse);
      setStatusMessage(null);
      return;
    }

    if (currentLetter === letter) {
      setSelectedLetter(null);
      setEraseMode(false);
      return;
    }

    pushHistorySnapshot();
    replaceAssignments({
      ...value.assignments,
      [symbol]: letter,
    });
    setFocusedSymbol(null);
    setSelectedLetter(null);
    setEraseMode(false);
    setPuzzleError(null);
    setStatusMessage(null);
    setWrongSymbols((current) => current.filter((entry) => entry !== symbol));
  }

  function clearSymbol(symbol: string) {
    if (!value.assignments[symbol]) {
      return;
    }

    const nextAssignments = { ...value.assignments };
    delete nextAssignments[symbol];
    pushHistorySnapshot();
    replaceAssignments(nextAssignments);
    setFocusedSymbol(null);
    setPuzzleError(null);
    setStatusMessage(null);
    setWrongSymbols((current) => current.filter((entry) => entry !== symbol));
  }

  function handleSymbolPress(symbol: string) {
    setFocusedSymbol(symbol);
    setPuzzleError(null);

    if (eraseMode) {
      clearSymbol(symbol);
      return;
    }

    if (selectedLetter) {
      applyLetterToSymbol(symbol, selectedLetter);
      return;
    }

    setSelectedLetter(null);
    setStatusMessage(t.step.alphabetSelectLetterFirst);
  }

  function handleUndo() {
    const previous = history[history.length - 1];

    if (!previous) {
      return;
    }

    replaceAssignments(previous);
    setHistory((current) => current.slice(0, -1));
    setPuzzleError(null);
    setStatusMessage(null);
    setWrongSymbols([]);
    setSelectedLetter(null);
    setEraseMode(false);
  }

  function handleReset() {
    if (Object.keys(value.assignments).length === 0) {
      return;
    }

    pushHistorySnapshot();
    replaceAssignments({});
    setSelectedLetter(null);
    setEraseMode(false);
    setFocusedSymbol(null);
    setPuzzleError(null);
    setStatusMessage(null);
    setWrongSymbols([]);
  }

  function handleEraseAction() {
    setSelectedLetter(null);
    setPuzzleError(null);
    setStatusMessage(null);

    if (focusedSymbol && value.assignments[focusedSymbol]) {
      setEraseMode(false);
      clearSymbol(focusedSymbol);
      return;
    }

    setEraseMode((current) => !current);
  }

  async function evaluateCurrentAssignments(action: "check" | "solve") {
    setBusyAction(action);
    setPuzzleError(null);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/steps/alphabet/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questAccessId,
          stepDocumentId,
          assignments: value.assignments,
        }),
      });
      const data = (await response.json()) as EvaluateResponse;

      if (!response.ok || !data.ok || !data.evaluation) {
        throw new Error(data.error ?? t.step.alphabetEvaluationError);
      }

      return data.evaluation;
    } catch (error) {
      setPuzzleError(
        error instanceof Error ? error.message : t.step.alphabetEvaluationError
      );
      return null;
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCheck() {
    setCheckCount((count) => count + 1);
    const evaluation = await evaluateCurrentAssignments("check");

    if (!evaluation) {
      return;
    }

    setWrongSymbols(evaluation.wrongSymbols);

    if (evaluation.wrongSymbols.length === 0) {
      setStatusMessage(t.step.alphabetCheckSuccess);
      showCheckFlash("success");
      return;
    }

    setStatusMessage(t.step.alphabetCheckErrors);
    showCheckFlash("error");
  }

  async function handleSolve() {
    setSolveCount((count) => count + 1);
    const evaluation = await evaluateCurrentAssignments("solve");

    if (!evaluation) {
      return;
    }

    setWrongSymbols(evaluation.wrongSymbols);

    if (!evaluation.solved) {
      setStatusMessage(
        evaluation.complete
          ? t.step.alphabetSolveErrors
          : t.step.alphabetSolveIncomplete
      );
      return;
    }

    const nextStats = {
      durationMs,
      checkCount,
      solveCount: solveCount + 1,
    };
    const result = await onRequestSolve(
      {
        type: "alphabet",
        assignments: value.assignments,
      },
      nextStats
    );

    if (!result) {
      return;
    }

    setCelebrate(true);
    setCompletionState({
      questCompleted: result.questCompleted,
      durationMs: result.stats.durationMs,
      checkCount: result.stats.checkCount,
      solveCount: result.stats.solveCount,
    });

    if (completionTimerRef.current) {
      window.clearTimeout(completionTimerRef.current);
    }

    completionTimerRef.current = window.setTimeout(() => {
      setCelebrate(false);
    }, 1500);
  }

  const selectionLabel = eraseMode
    ? t.step.alphabetEraseModeSelected
    : selectedLetter
      ? t.step.alphabetLetterSelected.replace("{letter}", selectedLetter)
      : focusedSymbol
        ? t.step.alphabetFocusedSymbol.replace("{symbol}", focusedSymbol)
        : t.step.alphabetSelectSymbol;

  return (
    <div
      className="space-y-6"
      style={{
        paddingBottom: `calc(${Math.max(stickyDockHeight, 0)}px + env(safe-area-inset-bottom, 0px) + 1rem)`,
      }}
    >
      {completionState ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-background/90 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-2xl">
            {celebrate
              ? Array.from({ length: 16 }, (_, index) => (
                  <span
                    key={`alphabet-confetti-${index}`}
                    className="alphabet-confetti"
                    style={
                      {
                        left: `${8 + index * 5.4}%`,
                        animationDelay: `${index * 45}ms`,
                        "--alphabet-confetti-rotate": `${index % 2 === 0 ? "" : "-"}${18 + index * 7}deg`,
                      } as CSSProperties
                    }
                  />
                ))
              : null}

            <div className={celebrate ? "alphabet-board-finish alphabet-board-celebrate" : "alphabet-board-finish"}>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {t.step.alphabetCompletionEyebrow}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{title}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                {t.step.alphabetCompletionTitle}
              </h2>
              <p className="mt-4 whitespace-pre-line text-base leading-7 text-card-foreground">
                {successText ||
                  (completionState.questCompleted
                    ? t.step.successCompletedBody
                    : t.step.successDefaultBody)}
              </p>

              <dl className="mt-6 grid gap-3 rounded-2xl border border-border bg-background/70 p-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">{t.step.alphabetStatTime}</dt>
                  <dd className="mt-1 text-xl font-semibold">
                    {formatDuration(completionState.durationMs)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t.step.alphabetStatChecks}</dt>
                  <dd className="mt-1 text-xl font-semibold">{completionState.checkCount}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t.step.alphabetStatSolves}</dt>
                  <dd className="mt-1 text-xl font-semibold">{completionState.solveCount}</dd>
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
          </div>
        </div>
      ) : null}

      {helpOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-border bg-card p-6 shadow-2xl">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {t.step.alphabetHelpTitle}
              </p>
              <p className="whitespace-pre-line text-base leading-7 text-card-foreground">
                {publicData.helpText || t.step.alphabetHelpDefaultBody}
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="inline-flex rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
              >
                {t.step.alphabetHelpClose}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card/80 p-4 shadow-sm sm:p-6">
        <div className="space-y-4">
          {lines.map((line, lineIndex) => (
            <div
              key={`alphabet-line-${lineIndex}`}
              className="flex flex-wrap gap-2 sm:gap-3"
            >
              {line.map((symbol, symbolIndex) => {
                const letter = value.assignments[symbol] ?? "";
                const isFocused = focusedSymbol === symbol;
                const hasError = wrongSymbols.includes(symbol);

                return (
                  <button
                    key={`alphabet-symbol-${lineIndex}-${symbolIndex}-${symbol}`}
                    type="button"
                    onClick={() => handleSymbolPress(symbol)}
                    className={[
                      "alphabet-symbol-card flex min-h-[4.8rem] min-w-[3.6rem] flex-col items-center justify-between rounded-2xl border px-2 py-2 text-center shadow-sm transition",
                      isFocused
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                        : "border-border bg-background/80 hover:border-primary/50",
                      hasError ? "alphabet-symbol-error border-destructive bg-destructive/10 text-destructive" : "",
                    ].join(" ")}
                  >
                    <span className="text-base font-semibold leading-none text-card-foreground">
                      {symbol}
                    </span>
                    <span className="mt-3 flex h-8 w-full items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/90 text-lg font-semibold uppercase tracking-[0.16em] text-foreground">
                      {letter || "\u00a0"}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div
        ref={stickyDockRef}
        className="sticky bottom-4 z-10 rounded-[2rem] border border-border bg-card/95 p-4 shadow-2xl backdrop-blur"
      >
        {checkFlashVariant ? (
          <div className="pointer-events-none absolute inset-x-0 -top-20 flex justify-center">
            <div
              className={[
                "alphabet-check-flash rounded-2xl px-5 py-4 text-center text-white shadow-2xl",
                checkFlashVariant === "success"
                  ? "border border-emerald-200/70 bg-emerald-500/92"
                  : "border border-red-200/70 bg-red-500/92",
              ].join(" ")}
            >
              <p
                className={[
                  "text-xs font-semibold uppercase tracking-[0.2em]",
                  checkFlashVariant === "success"
                    ? "text-emerald-50/90"
                    : "text-red-50/90",
                ].join(" ")}
              >
                {checkFlashVariant === "success"
                  ? t.step.alphabetCheckSuccessShort
                  : t.step.alphabetCheckErrorsShort}
              </p>
              <p className="mt-1 text-sm font-medium">
                {checkFlashVariant === "success"
                  ? t.step.alphabetCheckSuccess
                  : t.step.alphabetCheckErrors}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-card-foreground">{selectionLabel}</p>
            <p className="text-xs text-muted-foreground">
              {t.step.alphabetProgressLabel.replace("{filled}", String(filledSymbolCount)).replace(
                "{total}",
                String(symbolOrder.length)
              )}{" "}
              - {progressPercent}%
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border px-3 py-1.5">
              {t.step.alphabetStatTime}: {formatDuration(durationMs)}
            </span>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex rounded-full border border-border px-3 py-1.5 font-medium text-foreground hover:border-primary hover:text-primary"
            >
              {t.step.alphabetHelpButton}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-7">
          {shuffledLetters.map((letter) => {
            const assignedSymbol = usedLetters[letter];
            const isSelected = selectedLetter === letter;
            const isUsedByOtherSymbol =
              typeof assignedSymbol === "string" && assignedSymbol !== focusedSymbol;

            return (
              <button
                key={letter}
                type="button"
                onClick={() => {
                  if (focusedSymbol) {
                    applyLetterToSymbol(focusedSymbol, letter);
                    return;
                  }

                  setEraseMode(false);
                  setSelectedLetter((current) => (current === letter ? null : letter));
                  setPuzzleError(null);
                  setStatusMessage(null);
                }}
                className={[
                  "rounded-2xl border px-0 py-3 text-center text-base font-semibold transition",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-lg"
                    : isUsedByOtherSymbol
                      ? "border-border bg-muted/50 text-muted-foreground"
                      : "border-border bg-background text-card-foreground hover:border-primary/50 hover:text-primary",
                ].join(" ")}
              >
                {letter}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <button
            type="button"
            onClick={handleEraseAction}
            className={[
              "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
              eraseMode
                ? "border-amber-500 bg-amber-300/70 text-amber-950 shadow-[0_0_0_1px_rgba(245,158,11,0.25)]"
                : "border-border bg-background text-card-foreground hover:border-primary/50 hover:text-primary",
            ].join(" ")}
          >
            {t.step.alphabetEraseButton}
          </button>
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0}
            className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-card-foreground transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.step.alphabetUndoButton}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={Object.keys(value.assignments).length === 0}
            className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-card-foreground transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.step.alphabetResetButton}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleCheck();
            }}
            disabled={busyAction !== null}
            className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-card-foreground transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === "check" ? t.step.alphabetChecking : t.step.alphabetCheckButton}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSolve();
            }}
            disabled={busyAction !== null}
            className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === "solve" ? t.step.alphabetSolving : t.step.alphabetSolveButton}
          </button>
        </div>

        {statusMessage ? (
          <div className="mt-4 rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-muted-foreground">
            {statusMessage}
          </div>
        ) : null}

        {puzzleError ? (
          <p className="mt-3 text-sm text-destructive">{puzzleError}</p>
        ) : null}
      </div>

      <style>{`
        .alphabet-board-finish {
          transform-origin: center top;
        }

        .alphabet-board-celebrate {
          animation: alphabet-board-settle 520ms ease-out forwards;
        }

        .alphabet-symbol-error {
          animation: alphabet-cell-pulse 360ms ease-out;
        }

        .alphabet-confetti {
          position: absolute;
          top: -6%;
          width: 0.7rem;
          height: 1.2rem;
          border-radius: 999px;
          opacity: 0;
          background: linear-gradient(180deg, #f9a8d4 0%, #facc15 100%);
          transform: rotate(var(--alphabet-confetti-rotate));
          animation: alphabet-confetti-fall 1100ms ease-out forwards;
        }

        .alphabet-check-flash {
          animation: alphabet-check-fade 1.1s ease-out forwards;
        }

        @keyframes alphabet-board-settle {
          0% {
            transform: scale(1);
          }

          60% {
            transform: scale(0.96);
          }

          100% {
            transform: scale(0.98);
          }
        }

        @keyframes alphabet-cell-pulse {
          0% {
            transform: scale(1);
          }

          45% {
            transform: scale(0.92);
          }

          100% {
            transform: scale(1);
          }
        }

        @keyframes alphabet-confetti-fall {
          0% {
            opacity: 0;
            transform: translate3d(0, -18px, 0) rotate(0deg);
          }

          15% {
            opacity: 1;
          }

          100% {
            opacity: 0;
            transform: translate3d(10px, 200px, 0) rotate(280deg);
          }
        }

        @keyframes alphabet-check-fade {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }

          18%,
          68% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }

          100% {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
        }
      `}</style>
    </div>
  );
}
