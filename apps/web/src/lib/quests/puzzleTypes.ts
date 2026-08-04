export type PuzzleType =
  | "text"
  | "hangman"
  | "sudoku"
  | "alphabet"
  | "wordsearch"
  | "crossword";

export type TextPuzzlePublicData = {
  prompt?: string;
  hint?: string;
};

export type TextPuzzlePrivateData = {
  acceptedAnswers: string[];
  normalizeAccents?: boolean;
  normalizePunctuation?: boolean;
};

export type HangmanPuzzlePublicData = {
  prompt?: string;
  hint?: string;
  category?: string;
  maxWrongGuesses: number;
};

export type HangmanPuzzlePrivateData = {
  solution: string;
};

export type SudokuPuzzlePublicData = {
  prompt?: string;
  hint?: string;
  initialGrid: number[][];
};

export type SudokuPuzzlePrivateData = {
  solutionGrid: number[][];
};

export type AlphabetPuzzlePublicData = {
  prompt?: string;
  hint?: string;
  lines: string[];
  letterBank: string[];
  helpText?: string;
};

export type AlphabetPuzzlePrivateData = {
  solutionMap: Record<string, string>;
};

export type WordsearchPuzzleWord = {
  id: string;
  label: string;
  clue?: string;
};

export type WordsearchPuzzlePublicData = {
  prompt?: string;
  hint?: string;
  helpText?: string;
  grid: string[];
  words: WordsearchPuzzleWord[];
  allowHints: boolean;
  maxHints: number;
};

export type WordsearchPlacement = {
  id: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

export type WordsearchPuzzlePrivateData = {
  placements: WordsearchPlacement[];
};

export type CrosswordDirection = "across" | "down";

export type CrosswordPuzzleClue = {
  id: string;
  number: number;
  direction: CrosswordDirection;
  clue: string;
  row: number;
  col: number;
  length: number;
};

export type CrosswordPuzzlePublicData = {
  prompt?: string;
  hint?: string;
  helpText?: string;
  grid: string[];
  clues: CrosswordPuzzleClue[];
  allowHints: boolean;
  maxHints: number;
};

export type CrosswordPuzzlePrivateData = {
  solutions: Record<string, string>;
};

export type ParsedPublicPuzzle =
  | { type: "text"; data: TextPuzzlePublicData }
  | { type: "hangman"; data: HangmanPuzzlePublicData }
  | { type: "sudoku"; data: SudokuPuzzlePublicData }
  | { type: "alphabet"; data: AlphabetPuzzlePublicData }
  | { type: "wordsearch"; data: WordsearchPuzzlePublicData }
  | { type: "crossword"; data: CrosswordPuzzlePublicData };

export type ParsedPrivatePuzzle =
  | { type: "text"; data: TextPuzzlePrivateData }
  | { type: "hangman"; data: HangmanPuzzlePrivateData }
  | { type: "sudoku"; data: SudokuPuzzlePrivateData }
  | { type: "alphabet"; data: AlphabetPuzzlePrivateData }
  | { type: "wordsearch"; data: WordsearchPuzzlePrivateData }
  | { type: "crossword"; data: CrosswordPuzzlePrivateData };

export type TextSubmission = {
  type: "text";
  answer: string;
};

export type HangmanSubmission = {
  type: "hangman";
  guessedLetters: string[];
};

export type SudokuSubmission = {
  type: "sudoku";
  grid: number[][];
};

export type AlphabetSubmission = {
  type: "alphabet";
  assignments: Record<string, string>;
};

export type WordsearchSubmission = {
  type: "wordsearch";
  foundWordIds: string[];
};

export type CrosswordSubmission = {
  type: "crossword";
  cells: Record<string, string>;
};

export type SudokuCell = {
  row: number;
  column: number;
};

export type WordsearchCell = {
  row: number;
  col: number;
};

export type WordsearchDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "up-left"
  | "up-right"
  | "down-left"
  | "down-right";

export type CrosswordCell = WordsearchCell;

export type CrosswordCellMembership = {
  clueId: string;
  direction: CrosswordDirection;
  index: number;
  number: number;
};

export type SudokuEvaluation = {
  complete: boolean;
  conflictCells: SudokuCell[];
  wrongCells: SudokuCell[];
  errorCells: SudokuCell[];
  solved: boolean;
};

export type AlphabetEvaluation = {
  complete: boolean;
  solved: boolean;
  wrongSymbols: string[];
  filledSymbolCount: number;
  uniqueSymbolCount: number;
};

export type WordsearchSelectionEvaluation = {
  match: boolean;
  wordId: string | null;
  cells: WordsearchCell[];
  direction: WordsearchDirection | null;
  alreadyFound: boolean;
  solved: boolean;
  foundCount: number;
  totalCount: number;
};

export type WordsearchHintLevel = 1 | 2 | 3;

export type WordsearchHint = {
  wordId: string;
  level: WordsearchHintLevel;
  startCell: WordsearchCell;
  direction: WordsearchDirection;
  cells: WordsearchCell[] | null;
  foundCount: number;
  totalCount: number;
  remainingHints: number;
};

export type CrosswordEvaluation = {
  complete: boolean;
  solved: boolean;
  wrongClueIds: string[];
  wrongCells: CrosswordCell[];
  filledClueCount: number;
  totalClueCount: number;
};

export type CrosswordHintLevel = 1 | 2 | 3;

export type CrosswordHint = {
  clueId: string;
  level: CrosswordHintLevel;
  firstLetter: string | null;
  answer: string | null;
  filledClueCount: number;
  totalClueCount: number;
  remainingHints: number;
};

export type PuzzleSubmission =
  | TextSubmission
  | HangmanSubmission
  | SudokuSubmission
  | AlphabetSubmission
  | WordsearchSubmission
  | CrosswordSubmission;

export type HangmanPreview = {
  pattern: string[];
  guessedLetters: string[];
  wrongLetters: string[];
  wrongGuesses: number;
  remainingAttempts: number;
  solved: boolean;
  maxWrongGuesses: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizePuzzleType(value: unknown): PuzzleType {
  if (
    value === "text" ||
    value === "hangman" ||
    value === "sudoku" ||
    value === "alphabet" ||
    value === "wordsearch" ||
    value === "crossword"
  ) {
    return value;
  }

  throw new Error(`Unsupported puzzleType for validation yet: ${String(value)}`);
}

function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, minimum), maximum);
}

function normalizeLetter(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function isLetter(value: string) {
  return /^[A-Z]$/.test(normalizeLetter(value));
}

function toAlphabetLetter(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeLetter(value.trim());
  return /^[A-Z]$/.test(normalized) ? normalized : null;
}

export function tokenizeAlphabetLine(line: string) {
  return line
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function parseAlphabetLines(value: unknown) {
  const lines = Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];

  if (lines.length === 0) {
    throw new Error("Alphabet lines must not be empty.");
  }

  return lines;
}

function parseAlphabetLetterBank(value: unknown) {
  const letters = Array.isArray(value)
    ? value
        .map((entry) => toAlphabetLetter(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  if (letters.length === 0) {
    throw new Error("Alphabet letterBank must not be empty.");
  }

  return Array.from(new Set(letters));
}

function parseAlphabetSolutionMap(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("Alphabet solutionMap must be an object.");
  }

  const entries = Object.entries(value)
    .map(([symbol, letter]) => [symbol.trim(), toAlphabetLetter(letter)] as const)
    .filter(([symbol]) => symbol.length > 0);

  if (entries.length === 0) {
    throw new Error("Alphabet solutionMap must not be empty.");
  }

  const solutionMap: Record<string, string> = {};
  const usedLetters = new Set<string>();

  entries.forEach(([symbol, letter]) => {
    if (!letter) {
      throw new Error(`Alphabet solutionMap entry "${symbol}" is invalid.`);
    }

    if (usedLetters.has(letter)) {
      throw new Error("Alphabet solutionMap must use unique letters.");
    }

    solutionMap[symbol] = letter;
    usedLetters.add(letter);
  });

  return solutionMap;
}

function parseAlphabetAssignments(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([symbol, letter]) => [symbol.trim(), toAlphabetLetter(letter)] as const)
      .filter(
        (entry): entry is [string, string] =>
          entry[0].length > 0 && typeof entry[1] === "string"
      )
  );
}

function normalizeWordsearchRow(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizeWordsearchLabel(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

function parseWordsearchGrid(value: unknown) {
  const grid = Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map(normalizeWordsearchRow)
        .filter((entry) => entry.length > 0)
    : [];

  if (grid.length === 0) {
    throw new Error("Wordsearch grid must not be empty.");
  }

  const width = grid[0]?.length ?? 0;

  if (!width || grid.some((row) => row.length !== width || !/^[A-Z]+$/.test(row))) {
    throw new Error("Wordsearch grid must be rectangular and contain only letters.");
  }

  return grid;
}

function parseWordsearchWords(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Wordsearch words must not be empty.");
  }

  const words = value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Wordsearch word at index ${index} is invalid.`);
    }

    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    const normalizedLabel = label ? normalizeWordsearchLabel(label) : "";

    if (!id) {
      throw new Error(`Wordsearch word at index ${index} is missing an id.`);
    }

    if (!normalizedLabel || normalizedLabel.length < 2) {
      throw new Error(`Wordsearch word "${id}" must contain at least two letters.`);
    }

    return {
      id,
      label,
      clue: toOptionalString(entry.clue),
    } satisfies WordsearchPuzzleWord;
  });

  if (new Set(words.map((word) => word.id)).size !== words.length) {
    throw new Error("Wordsearch word ids must be unique.");
  }

  return words;
}

function parseWordsearchPlacements(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Wordsearch placements must not be empty.");
  }

  const placements = value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Wordsearch placement at index ${index} is invalid.`);
    }

    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const startRow = Number(entry.startRow);
    const startCol = Number(entry.startCol);
    const endRow = Number(entry.endRow);
    const endCol = Number(entry.endCol);

    if (!id) {
      throw new Error(`Wordsearch placement at index ${index} is missing an id.`);
    }

    if (![startRow, startCol, endRow, endCol].every((numeric) => Number.isInteger(numeric))) {
      throw new Error(`Wordsearch placement "${id}" has invalid coordinates.`);
    }

    return {
      id,
      startRow,
      startCol,
      endRow,
      endCol,
    } satisfies WordsearchPlacement;
  });

  if (new Set(placements.map((placement) => placement.id)).size !== placements.length) {
    throw new Error("Wordsearch placement ids must be unique.");
  }

  return placements;
}

function parseWordsearchFoundWordIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  );
}

function normalizeCrosswordGridRow(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function normalizeCrosswordAnswer(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

function parseCrosswordGrid(value: unknown) {
  const grid = Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map(normalizeCrosswordGridRow)
        .filter((entry) => entry.length > 0)
    : [];

  if (grid.length === 0) {
    throw new Error("Crossword grid must not be empty.");
  }

  const width = grid[0]?.length ?? 0;

  if (!width || grid.some((row) => row.length !== width || !/^[.#]+$/.test(row))) {
    throw new Error("Crossword grid must be rectangular and contain only '.' and '#'.");
  }

  return grid;
}

function parseCrosswordClues(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Crossword clues must not be empty.");
  }

  const clues = value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Crossword clue at index ${index} is invalid.`);
    }

    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const clue = typeof entry.clue === "string" ? entry.clue.trim() : "";
    const number = Number(entry.number);
    const direction =
      entry.direction === "across" || entry.direction === "down"
        ? entry.direction
        : null;
    const row = Number(entry.row);
    const col = Number(entry.col);
    const length = Number(entry.length);

    if (!id) {
      throw new Error(`Crossword clue at index ${index} is missing an id.`);
    }

    if (!clue) {
      throw new Error(`Crossword clue "${id}" is missing clue text.`);
    }

    if (!Number.isInteger(number) || number < 1) {
      throw new Error(`Crossword clue "${id}" must have a positive number.`);
    }

    if (!direction) {
      throw new Error(`Crossword clue "${id}" must use direction "across" or "down".`);
    }

    if (![row, col, length].every((value) => Number.isInteger(value))) {
      throw new Error(`Crossword clue "${id}" has invalid coordinates or length.`);
    }

    if (length < 2) {
      throw new Error(`Crossword clue "${id}" must be at least two letters long.`);
    }

    return {
      id,
      number,
      direction,
      clue,
      row,
      col,
      length,
    } satisfies CrosswordPuzzleClue;
  });

  if (new Set(clues.map((clue) => clue.id)).size !== clues.length) {
    throw new Error("Crossword clue ids must be unique.");
  }

  return clues;
}

function parseCrosswordSolutions(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("Crossword solutions must be an object.");
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([clueId, answer]) => [clueId.trim(), normalizeCrosswordAnswer(String(answer ?? ""))] as const)
      .filter((entry): entry is [string, string] => entry[0].length > 0 && entry[1].length > 0)
  );
}

function parseCrosswordCellValues(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([cellKey, letter]) => [cellKey.trim(), normalizeCrosswordAnswer(String(letter ?? ""))] as const)
      .filter(
        (entry): entry is [string, string] =>
          /^\d+:\d+$/.test(entry[0]) && entry[1].length === 1
      )
  );
}

function normalizeLetterList(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("Hangman guessed letters must be an array.");
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => normalizeLetter(entry))
    .filter((entry) => /^[A-Z]$/.test(entry));

  return Array.from(new Set(normalized));
}

function parseGrid(
  value: unknown,
  options: { allowZero: boolean; label: string }
) {
  if (!Array.isArray(value) || value.length !== 9) {
    throw new Error(`${options.label} must be a 9x9 grid.`);
  }

  return value.map((row) => {
    if (!Array.isArray(row) || row.length !== 9) {
      throw new Error(`${options.label} must be a 9x9 grid.`);
    }

    return row.map((cell) => {
      const numeric = Number(cell);

      if (!Number.isInteger(numeric)) {
        throw new Error(`${options.label} contains invalid cell values.`);
      }

      const minimum = options.allowZero ? 0 : 1;
      if (numeric < minimum || numeric > 9) {
        throw new Error(`${options.label} contains invalid cell values.`);
      }

      return numeric;
    });
  });
}

export function parsePublicPuzzleData(
  puzzleTypeValue: unknown,
  raw: unknown
): ParsedPublicPuzzle {
  const puzzleType = normalizePuzzleType(puzzleTypeValue);
  const data = isRecord(raw) ? raw : {};

  switch (puzzleType) {
    case "text":
      return {
        type: "text",
        data: {
          prompt: toOptionalString(data.prompt),
          hint: toOptionalString(data.hint),
        },
      };
    case "hangman":
      return {
        type: "hangman",
        data: {
          prompt: toOptionalString(data.prompt),
          hint: toOptionalString(data.hint),
          category: toOptionalString(data.category),
          maxWrongGuesses: parsePositiveInteger(
            data.maxWrongGuesses,
            6,
            3,
            12
          ),
        },
      };
    case "sudoku":
      return {
        type: "sudoku",
        data: {
          prompt: toOptionalString(data.prompt),
          hint: toOptionalString(data.hint),
          initialGrid: parseGrid(data.initialGrid, {
            allowZero: true,
            label: "Sudoku initialGrid",
          }),
        },
      };
    case "alphabet":
      return {
        type: "alphabet",
        data: {
          prompt: toOptionalString(data.prompt),
          hint: toOptionalString(data.hint),
          lines: parseAlphabetLines(data.lines),
          letterBank: parseAlphabetLetterBank(data.letterBank),
          helpText: toOptionalString(data.helpText),
        },
      };
    case "wordsearch": {
      const allowHints = normalizeBoolean(data.allowHints, true);

      return {
        type: "wordsearch",
        data: {
          prompt: toOptionalString(data.prompt),
          hint: toOptionalString(data.hint),
          helpText: toOptionalString(data.helpText),
          grid: parseWordsearchGrid(data.grid),
          words: parseWordsearchWords(data.words),
          allowHints,
          maxHints: allowHints
            ? parsePositiveInteger(data.maxHints, 3, 1, 20)
            : 0,
        },
      };
    }
    case "crossword": {
      const allowHints = normalizeBoolean(data.allowHints, true);

      return {
        type: "crossword",
        data: {
          prompt: toOptionalString(data.prompt),
          hint: toOptionalString(data.hint),
          helpText: toOptionalString(data.helpText),
          grid: parseCrosswordGrid(data.grid),
          clues: parseCrosswordClues(data.clues),
          allowHints,
          maxHints: allowHints
            ? parsePositiveInteger(data.maxHints, 3, 1, 20)
            : 0,
        },
      };
    }
  }
}

export function parsePrivatePuzzleData(
  puzzleTypeValue: unknown,
  raw: unknown
): ParsedPrivatePuzzle {
  const puzzleType = normalizePuzzleType(puzzleTypeValue);
  const data = isRecord(raw) ? raw : {};

  switch (puzzleType) {
    case "text": {
      const acceptedAnswers = Array.isArray(data.acceptedAnswers)
        ? data.acceptedAnswers.filter(
            (entry): entry is string =>
              typeof entry === "string" && entry.trim().length > 0
          )
        : [];

      if (acceptedAnswers.length === 0) {
        throw new Error("Text puzzle acceptedAnswers must not be empty.");
      }

      return {
        type: "text",
        data: {
          acceptedAnswers,
          normalizeAccents: normalizeBoolean(data.normalizeAccents, true),
          normalizePunctuation: normalizeBoolean(data.normalizePunctuation, true),
        },
      };
    }
    case "hangman": {
      const solution = typeof data.solution === "string" ? data.solution.trim() : "";

      if (!solution) {
        throw new Error("Hangman solution must not be empty.");
      }

      return {
        type: "hangman",
        data: {
          solution,
        },
      };
    }
    case "sudoku":
      return {
        type: "sudoku",
        data: {
          solutionGrid: parseGrid(data.solutionGrid, {
            allowZero: false,
            label: "Sudoku solutionGrid",
          }),
        },
      };
    case "alphabet":
      return {
        type: "alphabet",
        data: {
          solutionMap: parseAlphabetSolutionMap(data.solutionMap),
        },
      };
    case "wordsearch":
      return {
        type: "wordsearch",
        data: {
          placements: parseWordsearchPlacements(data.placements),
        },
      };
    case "crossword":
      return {
        type: "crossword",
        data: {
          solutions: parseCrosswordSolutions(data.solutions),
        },
      };
  }
}

export function parsePuzzleSubmission(
  puzzleTypeValue: unknown,
  raw: unknown
): PuzzleSubmission {
  const puzzleType = normalizePuzzleType(puzzleTypeValue);
  const data = isRecord(raw) ? raw : {};

  switch (puzzleType) {
    case "text":
      if (typeof data.answer !== "string") {
        throw new Error("Text submission is missing an answer.");
      }

      return {
        type: "text",
        answer: data.answer,
      };
    case "hangman":
      return {
        type: "hangman",
        guessedLetters: normalizeLetterList(data.guessedLetters),
      };
    case "sudoku":
      return {
        type: "sudoku",
        grid: parseGrid(data.grid, {
          allowZero: true,
          label: "Sudoku submission grid",
        }),
      };
    case "alphabet":
      return {
        type: "alphabet",
        assignments: parseAlphabetAssignments(data.assignments),
      };
    case "wordsearch":
      return {
        type: "wordsearch",
        foundWordIds: parseWordsearchFoundWordIds(data.foundWordIds),
      };
    case "crossword":
      return {
        type: "crossword",
        cells: parseCrosswordCellValues(data.cells),
      };
  }
}

export function normalizeTextAnswer(
  value: string,
  options?: {
    normalizeAccents?: boolean;
    normalizePunctuation?: boolean;
  }
) {
  let normalized = value.trim().toLowerCase();

  if (options?.normalizeAccents) {
    normalized = normalized
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  if (options?.normalizePunctuation) {
    normalized = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ");
  }

  return normalized.replace(/\s+/g, " ").trim();
}

export function validateTextSubmission(
  config: TextPuzzlePrivateData,
  submission: TextSubmission
) {
  const normalizedAnswer = normalizeTextAnswer(submission.answer, config);
  return config.acceptedAnswers
    .map((acceptedAnswer) => normalizeTextAnswer(acceptedAnswer, config))
    .includes(normalizedAnswer);
}

export function buildHangmanPreview(
  solution: string,
  guessedLetters: string[],
  maxWrongGuesses: number
): HangmanPreview {
  const normalizedGuesses = Array.from(new Set(guessedLetters.map(normalizeLetter)));
  const normalizedSolutionLetters = Array.from(
    new Set(
      solution
        .split("")
        .map((character) => normalizeLetter(character))
        .filter((character) => isLetter(character))
    )
  );

  const wrongLetters = normalizedGuesses.filter(
    (letter) => !normalizedSolutionLetters.includes(letter)
  );

  const pattern = solution.split("").map((character) => {
    if (!isLetter(character)) {
      return character;
    }

    const normalizedCharacter = normalizeLetter(character);
    return normalizedGuesses.includes(normalizedCharacter) ? character : "_";
  });

  const solved = pattern.every((character) => character !== "_");
  const wrongGuesses = wrongLetters.length;
  const remainingAttempts = Math.max(maxWrongGuesses - wrongGuesses, 0);

  return {
    pattern,
    guessedLetters: normalizedGuesses,
    wrongLetters,
    wrongGuesses,
    remainingAttempts,
    solved,
    maxWrongGuesses,
  };
}

export function validateHangmanSubmission(
  publicData: HangmanPuzzlePublicData,
  privateData: HangmanPuzzlePrivateData,
  submission: HangmanSubmission
) {
  return buildHangmanPreview(
    privateData.solution,
    submission.guessedLetters,
    publicData.maxWrongGuesses
  ).solved;
}

export function cloneSudokuGrid(grid: number[][]) {
  return grid.map((row) => [...row]);
}

export function isSudokuGridComplete(grid: number[][]) {
  return grid.every((row) => row.every((cell) => Number(cell) >= 1 && Number(cell) <= 9));
}

function getSudokuCellKey(row: number, column: number) {
  return `${row}:${column}`;
}

function sortSudokuCells(cells: SudokuCell[]) {
  return [...cells].sort((left, right) =>
    left.row === right.row ? left.column - right.column : left.row - right.row
  );
}

export function findSudokuConflictCells(grid: number[][]): SudokuCell[] {
  const parsedGrid = parseGrid(grid, {
    allowZero: true,
    label: "Sudoku conflict grid",
  });
  const conflictMap = new Map<string, SudokuCell>();

  function markConflicts(cells: SudokuCell[]) {
    const seen = new Map<number, SudokuCell[]>();

    cells.forEach((cell) => {
      const value = parsedGrid[cell.row]?.[cell.column] ?? 0;

      if (value < 1 || value > 9) {
        return;
      }

      const existing = seen.get(value) ?? [];
      existing.push(cell);
      seen.set(value, existing);
    });

    seen.forEach((entries) => {
      if (entries.length < 2) {
        return;
      }

      entries.forEach((entry) => {
        conflictMap.set(getSudokuCellKey(entry.row, entry.column), entry);
      });
    });
  }

  for (let row = 0; row < 9; row += 1) {
    markConflicts(
      Array.from({ length: 9 }, (_, column) => ({
        row,
        column,
      }))
    );
  }

  for (let column = 0; column < 9; column += 1) {
    markConflicts(
      Array.from({ length: 9 }, (_, row) => ({
        row,
        column,
      }))
    );
  }

  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      const cells: SudokuCell[] = [];

      for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < 3; columnOffset += 1) {
          cells.push({
            row: boxRow * 3 + rowOffset,
            column: boxColumn * 3 + columnOffset,
          });
        }
      }

      markConflicts(cells);
    }
  }

  return sortSudokuCells(Array.from(conflictMap.values()));
}

export function findSudokuWrongCells(
  solutionGrid: number[][],
  grid: number[][]
): SudokuCell[] {
  const submitted = parseGrid(grid, {
    allowZero: true,
    label: "Sudoku wrong-cell grid",
  });
  const expected = parseGrid(solutionGrid, {
    allowZero: false,
    label: "Sudoku solutionGrid",
  });
  const wrongCells: SudokuCell[] = [];

  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      const value = submitted[row][column];

      if (value === 0) {
        continue;
      }

      if (value !== expected[row][column]) {
        wrongCells.push({ row, column });
      }
    }
  }

  return wrongCells;
}

export function evaluateSudokuGrid(
  solutionGrid: number[][],
  grid: number[][]
): SudokuEvaluation {
  const parsedGrid = parseGrid(grid, {
    allowZero: true,
    label: "Sudoku evaluation grid",
  });
  const conflictCells = findSudokuConflictCells(parsedGrid);
  const wrongCells = findSudokuWrongCells(solutionGrid, parsedGrid);
  const errorMap = new Map<string, SudokuCell>();

  [...conflictCells, ...wrongCells].forEach((cell) => {
    errorMap.set(getSudokuCellKey(cell.row, cell.column), cell);
  });

  const complete = isSudokuGridComplete(parsedGrid);
  const errorCells = sortSudokuCells(Array.from(errorMap.values()));

  return {
    complete,
    conflictCells,
    wrongCells,
    errorCells,
    solved: complete && errorCells.length === 0,
  };
}

export function validateSudokuSubmission(
  privateData: SudokuPuzzlePrivateData,
  submission: SudokuSubmission
) {
  return evaluateSudokuGrid(privateData.solutionGrid, submission.grid).solved;
}

export function isSudokuClueCell(initialGrid: number[][], row: number, column: number) {
  return Number(initialGrid[row]?.[column] ?? 0) > 0;
}

export function getAlphabetSymbolsInOrder(lines: string[]) {
  const symbols: string[] = [];
  const seen = new Set<string>();

  lines.forEach((line) => {
    tokenizeAlphabetLine(line).forEach((symbol) => {
      if (!seen.has(symbol)) {
        seen.add(symbol);
        symbols.push(symbol);
      }
    });
  });

  return symbols;
}

export function evaluateAlphabetAssignments(
  solutionMap: Record<string, string>,
  assignments: Record<string, string>
): AlphabetEvaluation {
  const normalizedSolutionMap = parseAlphabetSolutionMap(solutionMap);
  const normalizedAssignments = parseAlphabetAssignments(assignments);
  const symbols = Object.keys(normalizedSolutionMap);
  const wrongSymbols = symbols
    .filter((symbol) => {
      const value = normalizedAssignments[symbol];
      return typeof value === "string" && value !== normalizedSolutionMap[symbol];
    })
    .sort((left, right) => left.localeCompare(right, "fr-CH"));
  const filledSymbolCount = symbols.filter(
    (symbol) => typeof normalizedAssignments[symbol] === "string"
  ).length;
  const uniqueSymbolCount = symbols.length;
  const complete = filledSymbolCount === uniqueSymbolCount;

  return {
    complete,
    solved: complete && wrongSymbols.length === 0,
    wrongSymbols,
    filledSymbolCount,
    uniqueSymbolCount,
  };
}

export function validateAlphabetSubmission(
  privateData: AlphabetPuzzlePrivateData,
  submission: AlphabetSubmission
) {
  return evaluateAlphabetAssignments(privateData.solutionMap, submission.assignments).solved;
}

function sortWordsearchCells(cells: WordsearchCell[]) {
  return [...cells].sort((left, right) =>
    left.row === right.row ? left.col - right.col : left.row - right.row
  );
}

export function getWordsearchDirection(
  start: WordsearchCell,
  end: WordsearchCell
): WordsearchDirection | null {
  const rowDelta = end.row - start.row;
  const colDelta = end.col - start.col;
  const rowStep = Math.sign(rowDelta);
  const colStep = Math.sign(colDelta);
  const absRowDelta = Math.abs(rowDelta);
  const absColDelta = Math.abs(colDelta);

  if (rowDelta === 0 && colDelta === 0) {
    return null;
  }

  if (!(rowDelta === 0 || colDelta === 0 || absRowDelta === absColDelta)) {
    return null;
  }

  if (rowStep === -1 && colStep === 0) {
    return "up";
  }

  if (rowStep === 1 && colStep === 0) {
    return "down";
  }

  if (rowStep === 0 && colStep === -1) {
    return "left";
  }

  if (rowStep === 0 && colStep === 1) {
    return "right";
  }

  if (rowStep === -1 && colStep === -1) {
    return "up-left";
  }

  if (rowStep === -1 && colStep === 1) {
    return "up-right";
  }

  if (rowStep === 1 && colStep === -1) {
    return "down-left";
  }

  if (rowStep === 1 && colStep === 1) {
    return "down-right";
  }

  return null;
}

export function buildWordsearchCellsBetween(
  start: WordsearchCell,
  end: WordsearchCell
): WordsearchCell[] {
  const direction = getWordsearchDirection(start, end);

  if (!direction) {
    return [];
  }

  const rowStep = Math.sign(end.row - start.row);
  const colStep = Math.sign(end.col - start.col);
  const length =
    Math.max(Math.abs(end.row - start.row), Math.abs(end.col - start.col)) + 1;

  return Array.from({ length }, (_, index) => ({
    row: start.row + rowStep * index,
    col: start.col + colStep * index,
  }));
}

export function getWordsearchWordIdsInOrder(words: WordsearchPuzzleWord[]) {
  return words.map((word) => word.id);
}

export function getWordsearchNormalizedLabel(label: string) {
  return normalizeWordsearchLabel(label);
}

export function getWordsearchPlacementCells(placement: WordsearchPlacement) {
  return buildWordsearchCellsBetween(
    { row: placement.startRow, col: placement.startCol },
    { row: placement.endRow, col: placement.endCol }
  );
}

function getWordsearchLettersForCells(grid: string[], cells: WordsearchCell[]) {
  return cells.map((cell) => grid[cell.row]?.[cell.col] ?? "").join("");
}

function getWordsearchWordsById(words: WordsearchPuzzleWord[]) {
  return new Map(
    words.map((word) => [word.id, getWordsearchNormalizedLabel(word.label)] as const)
  );
}

function getWordsearchPlacementsById(placements: WordsearchPlacement[]) {
  return new Map(placements.map((placement) => [placement.id, placement] as const));
}

function areWordsearchCellsEqual(left: WordsearchCell[], right: WordsearchCell[]) {
  return (
    left.length === right.length &&
    left.every((cell, index) => cell.row === right[index]?.row && cell.col === right[index]?.col)
  );
}

function reverseWordsearchCells(cells: WordsearchCell[]) {
  return [...cells].reverse();
}

export function evaluateWordsearchSelection(
  publicData: WordsearchPuzzlePublicData,
  privateData: WordsearchPuzzlePrivateData,
  foundWordIds: string[],
  start: WordsearchCell,
  end: WordsearchCell
): WordsearchSelectionEvaluation {
  const grid = parseWordsearchGrid(publicData.grid);
  const words = parseWordsearchWords(publicData.words);
  const placements = parseWordsearchPlacements(privateData.placements);
  const cells = buildWordsearchCellsBetween(start, end);
  const direction = getWordsearchDirection(start, end);
  const foundSet = new Set(parseWordsearchFoundWordIds(foundWordIds));
  const wordsById = getWordsearchWordsById(words);
  const placementsById = getWordsearchPlacementsById(placements);

  if (cells.length === 0 || !direction) {
    return {
      match: false,
      wordId: null,
      cells: [],
      direction: null,
      alreadyFound: false,
      solved: foundSet.size === placements.length,
      foundCount: foundSet.size,
      totalCount: placements.length,
    };
  }

  const selectionLetters = getWordsearchLettersForCells(grid, cells);
  const reversedSelectionLetters = selectionLetters.split("").reverse().join("");

  for (const word of words) {
    const placement = placementsById.get(word.id);
    const normalizedLabel = wordsById.get(word.id);

    if (!placement || !normalizedLabel) {
      continue;
    }

    const placementCells = getWordsearchPlacementCells(placement);

    if (
      !areWordsearchCellsEqual(cells, placementCells) &&
      !areWordsearchCellsEqual(cells, reverseWordsearchCells(placementCells))
    ) {
      continue;
    }

    if (
      selectionLetters !== normalizedLabel &&
      reversedSelectionLetters !== normalizedLabel
    ) {
      continue;
    }

    const alreadyFound = foundSet.has(word.id);
    const foundCount = alreadyFound ? foundSet.size : foundSet.size + 1;

    return {
      match: true,
      wordId: word.id,
      cells,
      direction,
      alreadyFound,
      solved: foundCount === placements.length,
      foundCount,
      totalCount: placements.length,
    };
  }

  return {
    match: false,
    wordId: null,
    cells,
    direction,
    alreadyFound: false,
    solved: foundSet.size === placements.length,
    foundCount: foundSet.size,
    totalCount: placements.length,
  };
}

export function getWordsearchHint(
  publicData: WordsearchPuzzlePublicData,
  privateData: WordsearchPuzzlePrivateData,
  foundWordIds: string[],
  hintCountUsed: number,
  currentHintWordId?: string | null,
  currentHintLevel?: number | null
): WordsearchHint {
  const words = parseWordsearchWords(publicData.words);
  const placements = parseWordsearchPlacements(privateData.placements);
  const foundSet = new Set(parseWordsearchFoundWordIds(foundWordIds));
  const placementsById = getWordsearchPlacementsById(placements);

  if (!publicData.allowHints || publicData.maxHints < 1) {
    throw new Error("Hints are disabled for this wordsearch.");
  }

  if (hintCountUsed >= publicData.maxHints) {
    throw new Error("No hints remaining.");
  }

  const remainingIds = words
    .map((word) => word.id)
    .filter((id) => placementsById.has(id) && !foundSet.has(id));

  if (remainingIds.length === 0) {
    throw new Error("No wordsearch hint available.");
  }

  let wordId = remainingIds[0];
  let level: WordsearchHintLevel = 1;

  if (
    currentHintWordId &&
    remainingIds.includes(currentHintWordId) &&
    (currentHintLevel === 1 || currentHintLevel === 2 || currentHintLevel === 3)
  ) {
    if (currentHintLevel < 3) {
      wordId = currentHintWordId;
      level = (currentHintLevel + 1) as WordsearchHintLevel;
    } else {
      const nextWordId = remainingIds.find((id) => id !== currentHintWordId);
      wordId = nextWordId ?? currentHintWordId;
      level = nextWordId ? 1 : 3;
    }
  }

  const placement = placementsById.get(wordId);

  if (!placement) {
    throw new Error(`Missing placement for wordsearch word "${wordId}".`);
  }

  const cells = getWordsearchPlacementCells(placement);
  const direction = getWordsearchDirection(cells[0], cells[cells.length - 1]);

  if (!direction) {
    throw new Error(`Invalid direction for wordsearch word "${wordId}".`);
  }

  return {
    wordId,
    level,
    startCell: cells[0],
    direction,
    cells: level === 3 ? sortWordsearchCells(cells) : null,
    foundCount: foundSet.size,
    totalCount: placements.length,
    remainingHints: Math.max(publicData.maxHints - (hintCountUsed + 1), 0),
  };
}

export function validateWordsearchSubmission(
  privateData: WordsearchPuzzlePrivateData,
  submission: WordsearchSubmission
) {
  const expectedIds = Array.from(
    new Set(parseWordsearchPlacements(privateData.placements).map((placement) => placement.id))
  ).sort((left, right) => left.localeCompare(right, "fr-CH"));
  const submittedIds = parseWordsearchFoundWordIds(submission.foundWordIds).sort((left, right) =>
    left.localeCompare(right, "fr-CH")
  );

  return JSON.stringify(expectedIds) === JSON.stringify(submittedIds);
}

function getCrosswordCellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function sortCrosswordCells(cells: CrosswordCell[]) {
  return [...cells].sort((left, right) =>
    left.row === right.row ? left.col - right.col : left.row - right.row
  );
}

export function getCrosswordClueCells(clue: CrosswordPuzzleClue): CrosswordCell[] {
  return Array.from({ length: clue.length }, (_, index) => ({
    row: clue.row + (clue.direction === "down" ? index : 0),
    col: clue.col + (clue.direction === "across" ? index : 0),
  }));
}

export function getCrosswordCluesInOrder(clues: CrosswordPuzzleClue[]) {
  return [...clues].sort((left, right) => {
    if (left.number !== right.number) {
      return left.number - right.number;
    }

    if (left.row !== right.row) {
      return left.row - right.row;
    }

    if (left.col !== right.col) {
      return left.col - right.col;
    }

    return left.direction === right.direction ? 0 : left.direction === "across" ? -1 : 1;
  });
}

export function getCrosswordCellMemberships(clues: CrosswordPuzzleClue[]) {
  const memberships = new Map<string, CrosswordCellMembership[]>();

  clues.forEach((clue) => {
    getCrosswordClueCells(clue).forEach((cell, index) => {
      const key = getCrosswordCellKey(cell.row, cell.col);
      const current = memberships.get(key) ?? [];
      current.push({
        clueId: clue.id,
        direction: clue.direction,
        index,
        number: clue.number,
      });
      memberships.set(key, current);
    });
  });

  return memberships;
}

function parseCrosswordContext(
  publicData: CrosswordPuzzlePublicData,
  privateData?: CrosswordPuzzlePrivateData
) {
  const grid = parseCrosswordGrid(publicData.grid);
  const clues = parseCrosswordClues(publicData.clues);
  const solutions = privateData ? parseCrosswordSolutions(privateData.solutions) : null;
  const width = grid[0]?.length ?? 0;
  const cellMemberships = getCrosswordCellMemberships(clues);
  const fillableCellKeys = new Set<string>();

  grid.forEach((row, rowIndex) => {
    row.split("").forEach((cell, colIndex) => {
      if (cell === ".") {
        fillableCellKeys.add(getCrosswordCellKey(rowIndex, colIndex));
      }
    });
  });

  clues.forEach((clue) => {
    const clueCells = getCrosswordClueCells(clue);

    if (
      clueCells.some(
        (cell) =>
          cell.row < 0 ||
          cell.col < 0 ||
          cell.row >= grid.length ||
          cell.col >= width
      )
    ) {
      throw new Error(`Crossword clue "${clue.id}" is outside the grid bounds.`);
    }

    if (clueCells.some((cell) => grid[cell.row]?.[cell.col] !== ".")) {
      throw new Error(`Crossword clue "${clue.id}" must only pass through fillable cells.`);
    }

    if (clue.direction === "across") {
      if (clue.col > 0 && grid[clue.row]?.[clue.col - 1] === ".") {
        throw new Error(`Crossword clue "${clue.id}" must start at the beginning of an across answer.`);
      }

      const nextCol = clue.col + clue.length;

      if (nextCol < width && grid[clue.row]?.[nextCol] === ".") {
        throw new Error(`Crossword clue "${clue.id}" must end at the last cell of its across answer.`);
      }
    } else {
      if (clue.row > 0 && grid[clue.row - 1]?.[clue.col] === ".") {
        throw new Error(`Crossword clue "${clue.id}" must start at the beginning of a down answer.`);
      }

      const nextRow = clue.row + clue.length;

      if (nextRow < grid.length && grid[nextRow]?.[clue.col] === ".") {
        throw new Error(`Crossword clue "${clue.id}" must end at the last cell of its down answer.`);
      }
    }
  });

  fillableCellKeys.forEach((cellKey) => {
    if (!cellMemberships.has(cellKey)) {
      throw new Error(`Crossword fillable cell "${cellKey}" is not referenced by any clue.`);
    }
  });

  if (solutions) {
    const clueIds = new Set(clues.map((clue) => clue.id));

    clues.forEach((clue) => {
      const solution = solutions[clue.id];

      if (!solution) {
        throw new Error(`Missing crossword solution for clue "${clue.id}".`);
      }

      if (solution.length !== clue.length) {
        throw new Error(`Crossword clue "${clue.id}" solution length does not match clue length.`);
      }
    });

    Object.keys(solutions).forEach((clueId) => {
      if (!clueIds.has(clueId)) {
        throw new Error(`Crossword solution "${clueId}" does not match any clue.`);
      }
    });

    cellMemberships.forEach((memberships, cellKey) => {
      if (memberships.length < 2) {
        return;
      }

      const reference = solutions[memberships[0].clueId]?.[memberships[0].index];

      if (!reference) {
        throw new Error(`Crossword cell "${cellKey}" references an invalid solution.`);
      }

      memberships.slice(1).forEach((membership) => {
        if (solutions[membership.clueId]?.[membership.index] !== reference) {
          throw new Error(`Crossword crossing at "${cellKey}" uses inconsistent letters.`);
        }
      });
    });
  }

  return {
    grid,
    clues,
    solutions,
    cellMemberships,
  };
}

export function getCrosswordClueAnswer(
  clue: CrosswordPuzzleClue,
  cells: Record<string, string>
) {
  return getCrosswordClueLetters(clue, cells).join("");
}

export function getCrosswordClueLetters(
  clue: CrosswordPuzzleClue,
  cells: Record<string, string>
) {
  return getCrosswordClueCells(clue)
    .map((cell) => cells[getCrosswordCellKey(cell.row, cell.col)] ?? "")
    .slice(0, clue.length);
}

export function buildCrosswordCellValues(cells: Record<string, string>) {
  return parseCrosswordCellValues(cells);
}

export function evaluateCrosswordSubmission(
  publicData: CrosswordPuzzlePublicData,
  privateData: CrosswordPuzzlePrivateData,
  submission: CrosswordSubmission
): CrosswordEvaluation {
  const { clues, solutions } = parseCrosswordContext(publicData, privateData);

  if (!solutions) {
    throw new Error("Crossword solutions are missing.");
  }

  const cellValues = parseCrosswordCellValues(submission.cells);
  const wrongClueIds = new Set<string>();
  const wrongCellMap = new Map<string, CrosswordCell>();
  let filledClueCount = 0;

  clues.forEach((clue) => {
    const letters = getCrosswordClueLetters(clue, cellValues);
    const solution = solutions[clue.id];

    if (letters.every(Boolean)) {
      filledClueCount += 1;
    }

    getCrosswordClueCells(clue).forEach((cell, index) => {
      const enteredLetter = letters[index] ?? "";

      if (!enteredLetter) {
        return;
      }

      if (enteredLetter !== solution[index]) {
        wrongClueIds.add(clue.id);
        wrongCellMap.set(getCrosswordCellKey(cell.row, cell.col), cell);
      }
    });
  });

  const totalCount = clues.length;
  const complete = filledClueCount === totalCount;
  const wrongCells = sortCrosswordCells(Array.from(wrongCellMap.values()));

  return {
    complete,
    solved: complete && wrongCells.length === 0,
    wrongClueIds: Array.from(wrongClueIds).sort((left, right) =>
      left.localeCompare(right, "fr-CH")
    ),
    wrongCells,
    filledClueCount,
    totalClueCount: totalCount,
  };
}

export function getCrosswordHint(
  publicData: CrosswordPuzzlePublicData,
  privateData: CrosswordPuzzlePrivateData,
  submission: CrosswordSubmission,
  hintCountUsed: number,
  currentHintClueId?: string | null,
  currentHintLevel?: number | null
): CrosswordHint {
  const { clues, solutions } = parseCrosswordContext(publicData, privateData);

  if (!solutions) {
    throw new Error("Crossword solutions are missing.");
  }

  if (!publicData.allowHints || publicData.maxHints < 1) {
    throw new Error("Hints are disabled for this crossword.");
  }

  if (hintCountUsed >= publicData.maxHints) {
    throw new Error("No hints remaining.");
  }

  const evaluation = evaluateCrosswordSubmission(publicData, privateData, submission);
  const cellValues = parseCrosswordCellValues(submission.cells);
  const orderedClues = getCrosswordCluesInOrder(clues);
  const remainingClueIds = orderedClues
    .filter((clue) => {
      const letters = getCrosswordClueLetters(clue, cellValues);
      const solution = solutions[clue.id];

      return !letters.every((letter, index) => letter === solution[index]);
    })
    .map((clue) => clue.id);

  if (remainingClueIds.length === 0) {
    throw new Error("No crossword hint available.");
  }

  let clueId = remainingClueIds[0];
  let level: CrosswordHintLevel = 1;

  if (
    currentHintClueId &&
    remainingClueIds.includes(currentHintClueId) &&
    (currentHintLevel === 1 || currentHintLevel === 2 || currentHintLevel === 3)
  ) {
    if (currentHintLevel < 3) {
      clueId = currentHintClueId;
      level = (currentHintLevel + 1) as CrosswordHintLevel;
    } else {
      const nextClueId = remainingClueIds.find((id) => id !== currentHintClueId);
      clueId = nextClueId ?? currentHintClueId;
      level = nextClueId ? 1 : 3;
    }
  }

  const answer = solutions[clueId];

  if (!answer) {
    throw new Error(`Missing crossword solution for clue "${clueId}".`);
  }

  return {
    clueId,
    level,
    firstLetter: level >= 2 ? answer[0] ?? null : null,
    answer: level === 3 ? answer : null,
    filledClueCount: evaluation.filledClueCount,
    totalClueCount: evaluation.totalClueCount,
    remainingHints: Math.max(publicData.maxHints - (hintCountUsed + 1), 0),
  };
}

export function validateCrosswordSubmission(
  publicData: CrosswordPuzzlePublicData,
  privateData: CrosswordPuzzlePrivateData,
  submission: CrosswordSubmission
) {
  return evaluateCrosswordSubmission(publicData, privateData, submission).solved;
}
