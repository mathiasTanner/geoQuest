type PuzzleType = "text" | "hangman" | "sudoku";

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
