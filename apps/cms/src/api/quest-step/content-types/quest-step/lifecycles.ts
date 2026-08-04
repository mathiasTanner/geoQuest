type PuzzleType =
  | "text"
  | "hangman"
  | "sudoku"
  | "alphabet"
  | "wordsearch"
  | "crossword";

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

function validateAssistanceConfig(privateData: Record<string, unknown>) {
  if (!("assistance" in privateData) || privateData.assistance == null) {
    return;
  }

  if (!isRecord(privateData.assistance)) {
    fail("assistance must be an object when provided.");
  }

  const maxSmallHints = privateData.assistance.maxSmallHints;
  const hintPenaltySeconds = privateData.assistance.hintPenaltySeconds;
  const revealPenaltySeconds = privateData.assistance.revealPenaltySeconds;
  const smallHints = privateData.assistance.smallHints;
  const revealMessage = privateData.assistance.revealMessage;

  if (
    maxSmallHints !== undefined &&
    (!Number.isInteger(Number(maxSmallHints)) ||
      Number(maxSmallHints) < 0 ||
      Number(maxSmallHints) > 12)
  ) {
    fail("assistance.maxSmallHints must be an integer between 0 and 12.");
  }

  if (
    hintPenaltySeconds !== undefined &&
    (!Number.isInteger(Number(hintPenaltySeconds)) ||
      Number(hintPenaltySeconds) < 0 ||
      Number(hintPenaltySeconds) > 14400)
  ) {
    fail("assistance.hintPenaltySeconds must be an integer between 0 and 14400.");
  }

  if (
    revealPenaltySeconds !== undefined &&
    (!Number.isInteger(Number(revealPenaltySeconds)) ||
      Number(revealPenaltySeconds) < 0 ||
      Number(revealPenaltySeconds) > 86400)
  ) {
    fail("assistance.revealPenaltySeconds must be an integer between 0 and 86400.");
  }

  if (
    smallHints !== undefined &&
    (!Array.isArray(smallHints) ||
      smallHints.some((entry) => typeof entry !== "string" || !entry.trim()) ||
      smallHints.length > 12)
  ) {
    fail("assistance.smallHints must be an array of up to 12 non-empty strings.");
  }

  if (
    revealMessage !== undefined &&
    (typeof revealMessage !== "string" || !revealMessage.trim())
  ) {
    fail("assistance.revealMessage must be a non-empty string when provided.");
  }
}

function normalizeWordsearchRow(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();

  return /^[A-Z]+$/.test(normalized) ? normalized : null;
}

function normalizeWordsearchWord(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();

  return normalized.length >= 2 ? normalized : null;
}

function normalizeCrosswordGridRow(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, "").toUpperCase();
  return /^[.#]+$/.test(normalized) ? normalized : null;
}

function normalizeCrosswordAnswer(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();

  return normalized.length > 0 ? normalized : null;
}

function getWordsearchDirectionLength(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
) {
  const rowDelta = endRow - startRow;
  const colDelta = endCol - startCol;
  const absRowDelta = Math.abs(rowDelta);
  const absColDelta = Math.abs(colDelta);

  if (rowDelta === 0 && colDelta === 0) {
    return null;
  }

  if (!(rowDelta === 0 || colDelta === 0 || absRowDelta === absColDelta)) {
    return null;
  }

  return Math.max(absRowDelta, absColDelta) + 1;
}

function buildWordsearchCells(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
) {
  const length = getWordsearchDirectionLength(startRow, startCol, endRow, endCol);

  if (!length) {
    return null;
  }

  const rowStep = Math.sign(endRow - startRow);
  const colStep = Math.sign(endCol - startCol);

  return Array.from({ length }, (_, index) => ({
    row: startRow + rowStep * index,
    col: startCol + colStep * index,
  }));
}

function buildCrosswordCells(
  startRow: number,
  startCol: number,
  direction: "across" | "down",
  length: number
) {
  return Array.from({ length }, (_, index) => ({
    row: startRow + (direction === "down" ? index : 0),
    col: startCol + (direction === "across" ? index : 0),
  }));
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

function validateWordsearchPuzzle(
  publicData: Record<string, unknown>,
  privateData: Record<string, unknown>
) {
  const grid = Array.isArray(publicData.grid)
    ? publicData.grid
        .map((entry) => normalizeWordsearchRow(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];
  const words = Array.isArray(publicData.words) ? publicData.words : [];
  const placements = Array.isArray(privateData.placements) ? privateData.placements : [];
  const allowHints =
    typeof publicData.allowHints === "boolean" ? publicData.allowHints : true;
  const maxHints = Number(publicData.maxHints ?? 3);

  if (grid.length === 0) {
    fail("wordsearch puzzles require a non-empty grid.");
  }

  const width = grid[0]?.length ?? 0;

  if (!width || grid.some((row) => row.length !== width)) {
    fail("wordsearch puzzles require a rectangular grid.");
  }

  if (!Array.isArray(words) || words.length === 0) {
    fail("wordsearch puzzles require a non-empty words list.");
  }

  if (allowHints && (!Number.isInteger(maxHints) || maxHints < 1 || maxHints > 20)) {
    fail("wordsearch puzzles require maxHints between 1 and 20 when hints are enabled.");
  }

  const wordMap = new Map<string, string>();

  words.forEach((entry) => {
    if (!isRecord(entry)) {
      fail("wordsearch words entries must be objects.");
    }

    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const normalizedWord = normalizeWordsearchWord(entry.label);

    if (!id) {
      fail("wordsearch words require a non-empty id.");
    }

    if (wordMap.has(id)) {
      fail(`wordsearch word id "${id}" must be unique.`);
    }

    if (!normalizedWord) {
      fail(`wordsearch word "${id}" must contain at least two letters.`);
    }

    wordMap.set(id, normalizedWord);
  });

  if (!Array.isArray(placements) || placements.length !== wordMap.size) {
    fail("wordsearch puzzles require one placement per word.");
  }

  const placementIds = new Set<string>();

  placements.forEach((entry) => {
    if (!isRecord(entry)) {
      fail("wordsearch placements entries must be objects.");
    }

    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const startRow = Number(entry.startRow);
    const startCol = Number(entry.startCol);
    const endRow = Number(entry.endRow);
    const endCol = Number(entry.endCol);

    if (!id || !wordMap.has(id)) {
      fail(`wordsearch placement "${id}" must match an existing word id.`);
    }

    if (placementIds.has(id)) {
      fail(`wordsearch placement id "${id}" must be unique.`);
    }

    if (
      ![startRow, startCol, endRow, endCol].every((value) => Number.isInteger(value))
    ) {
      fail(`wordsearch placement "${id}" must use integer coordinates.`);
    }

    const cells = buildWordsearchCells(startRow, startCol, endRow, endCol);

    if (!cells) {
      fail(`wordsearch placement "${id}" must be horizontal, vertical, or diagonal.`);
    }

    if (
      cells.some(
        (cell) =>
          cell.row < 0 ||
          cell.col < 0 ||
          cell.row >= grid.length ||
          cell.col >= width
      )
    ) {
      fail(`wordsearch placement "${id}" must stay within the grid bounds.`);
    }

    const letters = cells.map((cell) => grid[cell.row][cell.col]).join("");
    const word = wordMap.get(id) ?? "";
    const reversedLetters = letters.split("").reverse().join("");

    if (letters !== word && reversedLetters !== word) {
      fail(`wordsearch placement "${id}" does not match its word in the grid.`);
    }

    placementIds.add(id);
  });
}

function validateCrosswordPuzzle(
  publicData: Record<string, unknown>,
  privateData: Record<string, unknown>
) {
  const grid = Array.isArray(publicData.grid)
    ? publicData.grid
        .map((entry) => normalizeCrosswordGridRow(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];
  const clues = Array.isArray(publicData.clues) ? publicData.clues : [];
  const solutions = isRecord(privateData.solutions) ? privateData.solutions : null;
  const allowHints =
    typeof publicData.allowHints === "boolean" ? publicData.allowHints : true;
  const maxHints = Number(publicData.maxHints ?? 3);

  if (grid.length === 0) {
    fail("crossword puzzles require a non-empty grid.");
  }

  const width = grid[0]?.length ?? 0;

  if (!width || grid.some((row) => row.length !== width)) {
    fail("crossword puzzles require a rectangular grid.");
  }

  if (!Array.isArray(clues) || clues.length === 0) {
    fail("crossword puzzles require a non-empty clues list.");
  }

  if (!solutions) {
    fail("crossword puzzles require a solutions object.");
  }

  if (allowHints && (!Number.isInteger(maxHints) || maxHints < 1 || maxHints > 20)) {
    fail("crossword puzzles require maxHints between 1 and 20 when hints are enabled.");
  }

  const fillableCellKeys = new Set<string>();

  grid.forEach((row, rowIndex) => {
    row.split("").forEach((cell, colIndex) => {
      if (cell === ".") {
        fillableCellKeys.add(`${rowIndex}:${colIndex}`);
      }
    });
  });

  if (fillableCellKeys.size === 0) {
    fail("crossword puzzles require at least one fillable cell.");
  }

  const clueIds = new Set<string>();
  const cellMemberships = new Map<
    string,
    Array<{ clueId: string; direction: "across" | "down"; index: number }>
  >();
  const normalizedSolutions = new Map<string, string>();

  clues.forEach((entry) => {
    if (!isRecord(entry)) {
      fail("crossword clues entries must be objects.");
    }

    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const number = Number(entry.number);
    const direction =
      entry.direction === "across" || entry.direction === "down"
        ? entry.direction
        : null;
    const row = Number(entry.row);
    const col = Number(entry.col);
    const length = Number(entry.length);
    const solution = normalizeCrosswordAnswer(solutions[id]);

    if (!id) {
      fail("crossword clues require a non-empty id.");
    }

    if (clueIds.has(id)) {
      fail(`crossword clue id "${id}" must be unique.`);
    }

    if (!Number.isInteger(number) || number < 1) {
      fail(`crossword clue "${id}" requires a positive number.`);
    }

    if (!direction) {
      fail(`crossword clue "${id}" must use direction "across" or "down".`);
    }

    if (![row, col, length].every((value) => Number.isInteger(value))) {
      fail(`crossword clue "${id}" must use integer coordinates and length.`);
    }

    if (length < 2) {
      fail(`crossword clue "${id}" must contain at least two cells.`);
    }

    if (!solution) {
      fail(`crossword clue "${id}" requires a non-empty solution.`);
    }

    if (solution.length !== length) {
      fail(`crossword clue "${id}" solution length must match clue length.`);
    }

    const cells = buildCrosswordCells(row, col, direction, length);

    if (
      cells.some(
        (cell) =>
          cell.row < 0 ||
          cell.col < 0 ||
          cell.row >= grid.length ||
          cell.col >= width
      )
    ) {
      fail(`crossword clue "${id}" must stay within the grid bounds.`);
    }

    if (cells.some((cell) => grid[cell.row][cell.col] !== ".")) {
      fail(`crossword clue "${id}" must only pass through fillable cells.`);
    }

    if (direction === "across") {
      if (col > 0 && grid[row][col - 1] === ".") {
        fail(`crossword clue "${id}" must start at the first cell of its across answer.`);
      }

      const nextCol = col + length;

      if (nextCol < width && grid[row][nextCol] === ".") {
        fail(`crossword clue "${id}" must end at the last cell of its across answer.`);
      }
    }

    if (direction === "down") {
      if (row > 0 && grid[row - 1][col] === ".") {
        fail(`crossword clue "${id}" must start at the first cell of its down answer.`);
      }

      const nextRow = row + length;

      if (nextRow < grid.length && grid[nextRow][col] === ".") {
        fail(`crossword clue "${id}" must end at the last cell of its down answer.`);
      }
    }

    cells.forEach((cell, index) => {
      const key = `${cell.row}:${cell.col}`;
      const memberships = cellMemberships.get(key) ?? [];

      if (memberships.some((membership) => membership.direction === direction)) {
        fail(
          `crossword cell (${cell.row}, ${cell.col}) is assigned to more than one ${direction} clue.`
        );
      }

      memberships.push({
        clueId: id,
        direction,
        index,
      });

      if (memberships.length > 2) {
        fail(`crossword cell (${cell.row}, ${cell.col}) belongs to too many clues.`);
      }

      cellMemberships.set(key, memberships);
    });

    normalizedSolutions.set(id, solution);
    clueIds.add(id);
  });

  fillableCellKeys.forEach((cellKey) => {
    if (!cellMemberships.has(cellKey)) {
      fail(`crossword fillable cell "${cellKey}" must belong to at least one clue.`);
    }
  });

  cellMemberships.forEach((memberships, key) => {
    if (memberships.length !== 2) {
      return;
    }

    const [first, second] = memberships;
    const firstSolution = normalizedSolutions.get(first.clueId);
    const secondSolution = normalizedSolutions.get(second.clueId);

    if (!firstSolution || !secondSolution) {
      fail(`crossword cell "${key}" references a clue without a solution.`);
    }

    if (firstSolution[first.index] !== secondSolution[second.index]) {
      fail(`crossword crossing at "${key}" must use the same letter in both solutions.`);
    }
  });
}

function validateQuestStepData(data: Record<string, unknown>) {
  const puzzleType = data.puzzleType as PuzzleType | undefined;
  const publicData = isRecord(data.puzzleDataPublic) ? data.puzzleDataPublic : null;
  const privateData = isRecord(data.puzzleDataPrivate) ? data.puzzleDataPrivate : null;

  if (!puzzleType || !publicData || !privateData) {
    return;
  }

  validateAssistanceConfig(privateData);

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
    case "wordsearch":
      validateWordsearchPuzzle(publicData, privateData);
      return;
    case "crossword":
      validateCrosswordPuzzle(publicData, privateData);
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
