export type PuzzleType = "text" | "hangman" | "sudoku" | "alphabet";

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

export type ParsedPublicPuzzle =
  | { type: "text"; data: TextPuzzlePublicData }
  | { type: "hangman"; data: HangmanPuzzlePublicData }
  | { type: "sudoku"; data: SudokuPuzzlePublicData }
  | { type: "alphabet"; data: AlphabetPuzzlePublicData };

export type ParsedPrivatePuzzle =
  | { type: "text"; data: TextPuzzlePrivateData }
  | { type: "hangman"; data: HangmanPuzzlePrivateData }
  | { type: "sudoku"; data: SudokuPuzzlePrivateData }
  | { type: "alphabet"; data: AlphabetPuzzlePrivateData };

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

export type SudokuCell = {
  row: number;
  column: number;
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

export type PuzzleSubmission =
  | TextSubmission
  | HangmanSubmission
  | SudokuSubmission
  | AlphabetSubmission;

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
  if (value === "text" || value === "hangman" || value === "sudoku" || value === "alphabet") {
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
