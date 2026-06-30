type PuzzleType = "text" | "hangman" | "sudoku" | "alphabet";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(`Quest step validation failed: ${message}`);
}

function parseGrid(value: unknown, allowZero: boolean, label: string) {
  if (!Array.isArray(value) || value.length !== 9) {
    fail(`${label} must be a 9x9 grid.`);
  }

  return value.map((row) => {
    if (!Array.isArray(row) || row.length !== 9) {
      fail(`${label} must be a 9x9 grid.`);
    }

    return row.map((cell) => {
      const numeric = Number(cell);
      const minimum = allowZero ? 0 : 1;

      if (!Number.isInteger(numeric) || numeric < minimum || numeric > 9) {
        fail(`${label} contains invalid values.`);
      }

      return numeric;
    });
  });
}

function validateTextPuzzle(
  publicData: Record<string, unknown>,
  privateData: Record<string, unknown>
) {
  if (
    Array.isArray(privateData.acceptedAnswers) &&
    privateData.acceptedAnswers.some((entry) => typeof entry === "string" && entry.trim())
  ) {
    return;
  }

  fail("text puzzles require at least one accepted answer.");
}

function validateHangmanPuzzle(
  publicData: Record<string, unknown>,
  privateData: Record<string, unknown>
) {
  const solution =
    typeof privateData.solution === "string" ? privateData.solution.trim() : "";
  const maxWrongGuesses = Number(publicData.maxWrongGuesses ?? 6);

  if (!solution) {
    fail("hangman puzzles require a non-empty solution.");
  }

  if (!Number.isInteger(maxWrongGuesses) || maxWrongGuesses < 3 || maxWrongGuesses > 12) {
    fail("hangman puzzles require maxWrongGuesses between 3 and 12.");
  }
}

function validateSudokuPuzzle(
  publicData: Record<string, unknown>,
  privateData: Record<string, unknown>
) {
  const initialGrid = parseGrid(publicData.initialGrid, true, "initialGrid");
  const solutionGrid = parseGrid(privateData.solutionGrid, false, "solutionGrid");

  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      const clue = initialGrid[row][column];

      if (clue !== 0 && clue !== solutionGrid[row][column]) {
        fail("sudoku initialGrid clues must match the solutionGrid.");
      }
    }
  }
}

function normalizeAlphabetLetter(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  return /^[A-Z]$/.test(normalized) ? normalized : null;
}

function tokenizeAlphabetLine(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function validateAlphabetPuzzle(
  publicData: Record<string, unknown>,
  privateData: Record<string, unknown>
) {
  const lines = Array.isArray(publicData.lines)
    ? publicData.lines.filter((entry): entry is string => typeof entry === "string")
    : [];
  const letterBank = Array.isArray(publicData.letterBank)
    ? publicData.letterBank
        .map((entry) => normalizeAlphabetLetter(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];
  const solutionMap = isRecord(privateData.solutionMap) ? privateData.solutionMap : null;

  if (lines.length === 0 || lines.every((line) => tokenizeAlphabetLine(line).length === 0)) {
    fail("alphabet puzzles require at least one non-empty line.");
  }

  if (letterBank.length === 0) {
    fail("alphabet puzzles require a non-empty letterBank.");
  }

  if (new Set(letterBank).size !== letterBank.length) {
    fail("alphabet puzzles require unique letters in letterBank.");
  }

  if (!solutionMap) {
    fail("alphabet puzzles require a solutionMap.");
  }

  const tokensInLines = new Set(lines.flatMap((line) => tokenizeAlphabetLine(line)));
  const normalizedEntries = Object.entries(solutionMap)
    .map(([symbol, letter]) => [symbol.trim(), normalizeAlphabetLetter(letter)] as const)
    .filter(([symbol]) => symbol.length > 0);

  if (normalizedEntries.length === 0) {
    fail("alphabet puzzles require at least one symbol in solutionMap.");
  }

  const usedLetters = new Set<string>();

  normalizedEntries.forEach(([symbol, letter]) => {
    if (!letter) {
      fail(`alphabet solutionMap entry "${symbol}" must map to a single letter.`);
    }

    if (!tokensInLines.has(symbol)) {
      fail(`alphabet solutionMap symbol "${symbol}" must appear in lines.`);
    }

    if (!letterBank.includes(letter)) {
      fail(`alphabet solutionMap letter "${letter}" must exist in letterBank.`);
    }

    if (usedLetters.has(letter)) {
      fail("alphabet puzzles require one unique letter per symbol.");
    }

    usedLetters.add(letter);
  });
}

function validateQuestStepData(data: Record<string, unknown>) {
  const puzzleType = data.puzzleType as PuzzleType | undefined;
  const publicData = isRecord(data.puzzleDataPublic) ? data.puzzleDataPublic : null;
  const privateData = isRecord(data.puzzleDataPrivate) ? data.puzzleDataPrivate : null;

  if (!puzzleType || !publicData || !privateData) {
    return;
  }

  switch (puzzleType) {
    case "text":
      validateTextPuzzle(publicData, privateData);
      return;
    case "hangman":
      validateHangmanPuzzle(publicData, privateData);
      return;
    case "sudoku":
      validateSudokuPuzzle(publicData, privateData);
      return;
    case "alphabet":
      validateAlphabetPuzzle(publicData, privateData);
      return;
    default:
      fail(`unsupported puzzle type "${String(puzzleType)}".`);
  }
}

export default {
  beforeCreate(event: { params: { data?: Record<string, unknown> } }) {
    if (event.params.data) {
      validateQuestStepData(event.params.data);
    }
  },

  beforeUpdate(event: { params: { data?: Record<string, unknown> } }) {
    if (event.params.data) {
      validateQuestStepData(event.params.data);
    }
  },
};
