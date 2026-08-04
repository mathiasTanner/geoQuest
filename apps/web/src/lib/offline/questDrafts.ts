import type {
  CrosswordHintLevel,
  PuzzleSubmission,
  WordsearchCell,
  WordsearchDirection,
  WordsearchHintLevel,
} from "@/lib/quests/puzzleTypes";

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

export type WordsearchDraftMeta = {
  startedAt?: number;
  hintCountUsed?: number;
  activeHintWordId?: string;
  activeHintLevel?: WordsearchHintLevel;
  activeHintStartCell?: WordsearchCell;
  activeHintDirection?: WordsearchDirection;
  activeHintCells?: WordsearchCell[];
  foundWordCellsById?: Record<string, WordsearchCell[]>;
};

export type CrosswordDraftMeta = {
  startedAt?: number;
  hintCountUsed?: number;
  activeHintClueId?: string;
  activeHintLevel?: CrosswordHintLevel;
  revealedCellKeys?: string[];
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

export type WordsearchQuestDraft = QuestDraftBase & {
  type: "wordsearch";
  foundWordIds: string[];
} & WordsearchDraftMeta;

export type CrosswordQuestDraft = QuestDraftBase & {
  type: "crossword";
  cells: Record<string, string>;
} & CrosswordDraftMeta;

export type QuestDraft =
  | TextQuestDraft
  | HangmanQuestDraft
  | SudokuQuestDraft
  | AlphabetQuestDraft
  | WordsearchQuestDraft
  | CrosswordQuestDraft;

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

function isWordsearchCell(value: unknown): value is WordsearchCell {
  return (
    value !== null &&
    typeof value === "object" &&
    Number.isInteger(Number((value as WordsearchCell).row)) &&
    Number.isInteger(Number((value as WordsearchCell).col))
  );
}

function normalizeWordsearchCell(value: unknown): WordsearchCell | undefined {
  if (!isWordsearchCell(value)) {
    return undefined;
  }

  return {
    row: Number((value as WordsearchCell).row),
    col: Number((value as WordsearchCell).col),
  };
}

function isWordsearchCellList(value: unknown): value is WordsearchCell[] {
  return Array.isArray(value) && value.every((entry) => isWordsearchCell(entry));
}

function normalizeWordsearchCellList(value: unknown) {
  if (!isWordsearchCellList(value)) {
    return undefined;
  }

  return value.map((entry) => ({
    row: Number(entry.row),
    col: Number(entry.col),
  }));
}

function isWordsearchDirection(value: unknown): value is WordsearchDirection {
  return (
    value === "up" ||
    value === "down" ||
    value === "left" ||
    value === "right" ||
    value === "up-left" ||
    value === "up-right" ||
    value === "down-left" ||
    value === "down-right"
  );
}

function isWordsearchHintLevel(value: unknown): value is WordsearchHintLevel {
  return value === 1 || value === 2 || value === 3;
}

function isWordsearchFoundWordCellsById(
  value: unknown
): value is Record<string, WordsearchCell[]> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([key, entry]) => typeof key === "string" && isWordsearchCellList(entry)
    )
  );
}

function isCrosswordCellMap(value: unknown): value is Record<string, string> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([key, entry]) =>
        /^\d+:\d+$/.test(key) && typeof entry === "string" && entry.trim().length === 1
    )
  );
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isCrosswordHintLevel(value: unknown): value is CrosswordHintLevel {
  return value === 1 || value === 2 || value === 3;
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

  if (
    raw.type === "wordsearch" &&
    Array.isArray(raw.foundWordIds) &&
    raw.foundWordIds.every((entry) => typeof entry === "string")
  ) {
    const rawActiveHintWordId = (raw as WordsearchQuestDraft).activeHintWordId;
    const activeHintWordId =
      typeof rawActiveHintWordId === "string"
        ? rawActiveHintWordId.trim()
        : "";
    const rawFoundWordCellsById = isWordsearchFoundWordCellsById(
      (raw as WordsearchQuestDraft).foundWordCellsById
    )
      ? (raw as WordsearchQuestDraft).foundWordCellsById
      : undefined;

    return {
      questAccessId,
      stepDocumentId,
      type: "wordsearch",
      foundWordIds: Array.from(
        new Set(
          raw.foundWordIds
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
        )
      ),
      startedAt:
        Number.isFinite(Number((raw as WordsearchQuestDraft).startedAt))
          ? Number((raw as WordsearchQuestDraft).startedAt)
          : undefined,
      hintCountUsed:
        Number.isFinite(Number((raw as WordsearchQuestDraft).hintCountUsed))
          ? Number((raw as WordsearchQuestDraft).hintCountUsed)
          : undefined,
      activeHintWordId:
        activeHintWordId.length > 0
          ? activeHintWordId
          : undefined,
      activeHintLevel: isWordsearchHintLevel(
        (raw as WordsearchQuestDraft).activeHintLevel
      )
        ? (raw as WordsearchQuestDraft).activeHintLevel
        : undefined,
      activeHintStartCell: normalizeWordsearchCell(
        (raw as WordsearchQuestDraft).activeHintStartCell
      ),
      activeHintDirection: isWordsearchDirection(
        (raw as WordsearchQuestDraft).activeHintDirection
      )
        ? (raw as WordsearchQuestDraft).activeHintDirection
        : undefined,
      activeHintCells: normalizeWordsearchCellList(
        (raw as WordsearchQuestDraft).activeHintCells
      ),
      foundWordCellsById: rawFoundWordCellsById
        ? Object.fromEntries(
            Object.entries(rawFoundWordCellsById).map(([key, cells]) => [
              key,
              cells.map((cell) => ({
                row: Number(cell.row),
                col: Number(cell.col),
              })),
            ])
          )
        : undefined,
      savedAt,
    };
  }

  if (raw.type === "crossword" && isCrosswordCellMap(raw.cells)) {
    const rawActiveHintClueId = (raw as CrosswordQuestDraft).activeHintClueId;
    const activeHintClueId =
      typeof rawActiveHintClueId === "string" ? rawActiveHintClueId.trim() : "";
    const rawRevealedCellKeys = isStringList(
      (raw as CrosswordQuestDraft).revealedCellKeys
    )
      ? (raw as CrosswordQuestDraft).revealedCellKeys
      : null;

    return {
      questAccessId,
      stepDocumentId,
      type: "crossword",
      cells: Object.fromEntries(
        Object.entries(raw.cells).map(([key, value]) => [key, value.trim().toUpperCase()])
      ),
      startedAt:
        Number.isFinite(Number((raw as CrosswordQuestDraft).startedAt))
          ? Number((raw as CrosswordQuestDraft).startedAt)
          : undefined,
      hintCountUsed:
        Number.isFinite(Number((raw as CrosswordQuestDraft).hintCountUsed))
          ? Number((raw as CrosswordQuestDraft).hintCountUsed)
          : undefined,
      activeHintClueId: activeHintClueId.length > 0 ? activeHintClueId : undefined,
      activeHintLevel: isCrosswordHintLevel(
        (raw as CrosswordQuestDraft).activeHintLevel
      )
        ? (raw as CrosswordQuestDraft).activeHintLevel
        : undefined,
      revealedCellKeys: rawRevealedCellKeys
        ? Array.from(
            new Set(
              rawRevealedCellKeys.filter((entry) => /^\d+:\d+$/.test(entry))
            )
          )
        : undefined,
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
  extras?: SudokuDraftMeta | WordsearchDraftMeta | CrosswordDraftMeta
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
    ...(draftValue.type === "sudoku" ||
    draftValue.type === "wordsearch" ||
    draftValue.type === "crossword"
      ? extras
      : undefined),
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
