import type { PuzzleSubmission } from "@/lib/quests/puzzleTypes";

const DRAFT_STORAGE_PREFIX = "geoquest:draft:";

type QuestDraftBase = {
  questAccessId: string;
  stepDocumentId: string;
  savedAt: number;
  stepRevision?: string;
};

export type SudokuDraftMeta = {
  startedAt?: number;
  checkCount?: number;
  solveCount?: number;
};

export type TextQuestDraft = QuestDraftBase & {
  type: "text";
  answer: string;
};

export type HangmanQuestDraft = QuestDraftBase & {
  type: "hangman";
  guessedLetters: string[];
};

export type SudokuQuestDraft = QuestDraftBase & {
  type: "sudoku";
  grid: number[][];
} & SudokuDraftMeta;

export type AlphabetQuestDraft = QuestDraftBase & {
  type: "alphabet";
  assignments: Record<string, string>;
};

export type QuestDraft =
  | TextQuestDraft
  | HangmanQuestDraft
  | SudokuQuestDraft
  | AlphabetQuestDraft;

function hasWindow() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getDraftKey(questAccessId: string, stepDocumentId: string) {
  return `${DRAFT_STORAGE_PREFIX}${questAccessId}:${stepDocumentId}`;
}

function isGrid(value: unknown): value is number[][] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        Array.isArray(row) &&
        row.every((cell) => Number.isInteger(Number(cell)))
    )
  );
}

function isAlphabetAssignments(value: unknown): value is Record<string, string> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([key, entry]) => typeof key === "string" && typeof entry === "string"
    )
  );
}

function normalizeDraft(
  value: unknown,
  questAccessId: string,
  stepDocumentId: string,
  stepRevision?: string
): QuestDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<QuestDraft> & { answer?: unknown };
  const savedAt = Number(raw.savedAt ?? Date.now());

  if ((raw.stepRevision ?? undefined) !== (stepRevision ?? undefined)) {
    return null;
  }

  if (
    raw.type === "text" &&
    typeof raw.answer === "string"
  ) {
    return {
      questAccessId,
      stepDocumentId,
      type: "text",
      answer: raw.answer,
      savedAt,
    };
  }

  if (
    raw.type === "hangman" &&
    Array.isArray(raw.guessedLetters) &&
    raw.guessedLetters.every((entry) => typeof entry === "string")
  ) {
    return {
      questAccessId,
      stepDocumentId,
      type: "hangman",
      guessedLetters: raw.guessedLetters,
      savedAt,
    };
  }

  if (raw.type === "sudoku" && isGrid(raw.grid)) {
    return {
      questAccessId,
      stepDocumentId,
      type: "sudoku",
      grid: raw.grid.map((row) => row.map((cell) => Number(cell))),
      startedAt:
        Number.isFinite(Number((raw as SudokuQuestDraft).startedAt))
          ? Number((raw as SudokuQuestDraft).startedAt)
          : undefined,
      checkCount:
        Number.isFinite(Number((raw as SudokuQuestDraft).checkCount))
          ? Number((raw as SudokuQuestDraft).checkCount)
          : undefined,
      solveCount:
        Number.isFinite(Number((raw as SudokuQuestDraft).solveCount))
          ? Number((raw as SudokuQuestDraft).solveCount)
          : undefined,
      savedAt,
    };
  }

  if (raw.type === "alphabet" && isAlphabetAssignments(raw.assignments)) {
    return {
      questAccessId,
      stepDocumentId,
      type: "alphabet",
      assignments: Object.fromEntries(
        Object.entries(raw.assignments).map(([key, value]) => [key, value])
      ),
      savedAt,
    };
  }

  if (typeof raw.answer === "string") {
    return {
      questAccessId,
      stepDocumentId,
      type: "text",
      answer: raw.answer,
      savedAt,
    };
  }

  return null;
}

export function loadQuestDraft(
  questAccessId: string,
  stepDocumentId: string,
  stepRevision?: string
): QuestDraft | null {
  if (!hasWindow()) {
    return null;
  }

  const raw = window.localStorage.getItem(getDraftKey(questAccessId, stepDocumentId));

  if (!raw) {
    return null;
  }

  try {
    return normalizeDraft(
      JSON.parse(raw),
      questAccessId,
      stepDocumentId,
      stepRevision
    );
  } catch {
    return null;
  }
}

export function saveQuestDraft(
  questAccessId: string,
  stepDocumentId: string,
  stepRevision: string | undefined,
  draftValue: PuzzleSubmission,
  extras?: SudokuDraftMeta
) {
  if (!hasWindow()) {
    return;
  }

  const draft: QuestDraft = {
    questAccessId,
    stepDocumentId,
    savedAt: Date.now(),
    stepRevision,
    ...draftValue,
    ...(draftValue.type === "sudoku" ? extras : undefined),
  };

  window.localStorage.setItem(getDraftKey(questAccessId, stepDocumentId), JSON.stringify(draft));
}

export function clearQuestDraft(questAccessId: string, stepDocumentId: string) {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.removeItem(getDraftKey(questAccessId, stepDocumentId));
}

export function clearQuestDraftsForQuestAccess(questAccessId: string) {
  if (!hasWindow()) {
    return;
  }

  const prefix = `${DRAFT_STORAGE_PREFIX}${questAccessId}:`;
  const keysToRemove: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (key?.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}
