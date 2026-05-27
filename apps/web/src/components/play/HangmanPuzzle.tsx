"use client";

import { useEffect, useMemo, useState } from "react";
import { getDictionary } from "@/lib/i18n";
import type {
  HangmanPreview,
  HangmanPuzzlePublicData,
  HangmanSubmission,
} from "@/lib/quests/puzzleTypes";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type HangmanPreviewResponse = {
  ok?: boolean;
  error?: string;
  preview?: HangmanPreview;
};

type HangmanPuzzleProps = {
  questAccessId: string;
  stepDocumentId: string;
  publicData: HangmanPuzzlePublicData;
  value: HangmanSubmission;
  onChange: (next: HangmanSubmission) => void;
  onReadyChange: (ready: boolean) => void;
};

function HangmanFigure({
  wrongGuesses,
}: {
  wrongGuesses: number;
}) {
  return (
    <svg
      viewBox="0 0 120 140"
      className="h-40 w-full max-w-[220px] text-foreground/80"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 128 H88" />
        <path d="M30 128 V12 H78" />
        <path d="M78 12 V28" />
        {wrongGuesses >= 1 ? <circle cx="78" cy="40" r="12" /> : null}
        {wrongGuesses >= 2 ? <path d="M78 52 V82" /> : null}
        {wrongGuesses >= 3 ? <path d="M78 62 L60 74" /> : null}
        {wrongGuesses >= 4 ? <path d="M78 62 L96 74" /> : null}
        {wrongGuesses >= 5 ? <path d="M78 82 L64 104" /> : null}
        {wrongGuesses >= 6 ? <path d="M78 82 L92 104" /> : null}
      </g>
    </svg>
  );
}

export default function HangmanPuzzle({
  questAccessId,
  stepDocumentId,
  publicData,
  value,
  onChange,
  onReadyChange,
}: HangmanPuzzleProps) {
  const t = getDictionary();
  const [preview, setPreview] = useState<HangmanPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guessedLettersKey = useMemo(
    () => value.guessedLetters.join(","),
    [value.guessedLetters]
  );

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/steps/hangman/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            questAccessId,
            stepDocumentId,
            guessedLetters: value.guessedLetters,
          }),
        });

        const data = (await response.json()) as HangmanPreviewResponse;

        if (!response.ok || !data.ok || !data.preview) {
          throw new Error(data.error ?? t.step.hangmanGenericError);
        }

        if (!active) {
          return;
        }

        setPreview(data.preview);
        onReadyChange(data.preview.solved);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        setPreview(null);
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : t.step.hangmanGenericError
        );
        onReadyChange(false);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [
    guessedLettersKey,
    onReadyChange,
    questAccessId,
    stepDocumentId,
    t.step.hangmanGenericError,
    value.guessedLetters,
  ]);

  const usedLetters = new Set(preview?.guessedLetters ?? value.guessedLetters);
  const locked = Boolean(preview?.solved) || (preview?.remainingAttempts ?? publicData.maxWrongGuesses) === 0;

  function handleGuess(letter: string) {
    if (loading || locked || usedLetters.has(letter)) {
      return;
    }

    onChange({
      type: "hangman",
      guessedLetters: [...value.guessedLetters, letter],
    });
  }

  return (
    <div className="space-y-5">
      {publicData.category ? (
        <p className="text-sm text-muted-foreground">
          {t.step.hangmanCategoryLabel}: {publicData.category}
        </p>
      ) : null}

      <div className="space-y-4 rounded-lg border border-border bg-background/70 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex justify-center md:w-[220px]">
            <HangmanFigure wrongGuesses={preview?.wrongGuesses ?? 0} />
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(preview?.pattern ?? []).map((character, index) => (
                <span
                  key={`${character}-${index}`}
                  className="inline-flex h-12 min-w-10 items-center justify-center rounded-md border border-border px-3 text-lg font-semibold uppercase"
                >
                  {character === "_" ? "" : character}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>
                {t.step.hangmanAttemptsRemaining}:{" "}
                {preview?.remainingAttempts ?? publicData.maxWrongGuesses}
              </span>
              <span>
                {t.step.hangmanWrongLetters}:{" "}
                {preview?.wrongLetters.length
                  ? preview.wrongLetters.join(", ")
                  : "\u2014"}
              </span>
            </div>
          </div>
        </div>

        {preview?.solved ? (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-300">
            {t.step.hangmanSolved}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">{t.step.hangmanLoading}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="grid grid-cols-7 gap-2 sm:grid-cols-9">
        {LETTERS.map((letter) => {
          const isUsed = usedLetters.has(letter);

          return (
            <button
              key={letter}
              type="button"
              onClick={() => handleGuess(letter)}
              disabled={loading || locked || isUsed}
              className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background text-sm font-semibold uppercase text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}
