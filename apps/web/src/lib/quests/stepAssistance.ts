import { getDictionary } from "@/lib/i18n";
import {
  buildHangmanPreview,
  cloneSudokuGrid,
  getAlphabetSymbolsInOrder,
  getCrosswordClueCells,
  getCrosswordCluesInOrder,
  getWordsearchPlacementCells,
  parsePuzzleSubmission,
  type AlphabetPuzzlePrivateData,
  type AlphabetPuzzlePublicData,
  type AlphabetSubmission,
  type CrosswordPuzzlePrivateData,
  type CrosswordPuzzlePublicData,
  type CrosswordSubmission,
  type HangmanPuzzlePrivateData,
  type HangmanPuzzlePublicData,
  type HangmanSubmission,
  type ParsedPrivatePuzzle,
  type ParsedPublicPuzzle,
  type PuzzleSubmission,
  type PuzzleType,
  type SudokuCell,
  type SudokuPuzzlePrivateData,
  type SudokuPuzzlePublicData,
  type SudokuSubmission,
  type TextPuzzlePrivateData,
  type WordsearchCell,
  type WordsearchDirection,
  type WordsearchPuzzlePrivateData,
  type WordsearchPuzzlePublicData,
  type WordsearchSubmission,
} from "@/lib/quests/puzzleTypes";

export const DEFAULT_SMALL_HINTS = 3;
export const DEFAULT_HINT_PENALTY_SECONDS = 120;
export const DEFAULT_REVEAL_PENALTY_SECONDS = 900;

export type StepAssistAction = "hint" | "reveal";

export type StepAssistanceConfig = {
  maxSmallHints: number;
  hintPenaltySeconds: number;
  revealPenaltySeconds: number;
  smallHints: string[];
  revealMessage?: string;
};

export type StepAssistUiState = {
  revealedCellKeys?: string[];
  revealedSymbols?: string[];
  foundWordCellsById?: Record<string, WordsearchCell[]>;
  activeHintWordId?: string;
  activeHintStartCell?: WordsearchCell;
  activeHintDirection?: WordsearchDirection;
  activeHintClueId?: string;
  hintedWordIds?: string[];
  hintedClueIds?: string[];
};

export type StepAssistanceSnapshot = {
  hintUses: number;
  revealUsed: boolean;
  penaltySeconds: number;
  hintPenaltySeconds: number;
  revealPenaltySeconds: number;
  hintMessages: string[];
  assistedSubmission?: PuzzleSubmission;
  uiState?: StepAssistUiState;
};

export type StepAssistResult = {
  nextState: StepAssistanceSnapshot;
  nextSubmission: PuzzleSubmission;
  statusMessage: string;
  penaltySecondsApplied: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampPositiveInteger(value: unknown, fallback: number, minimum = 0, maximum = 86400) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, minimum), maximum);
}

function normalizeWordsearchCell(value: unknown): WordsearchCell | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const row = Number(value.row);
  const col = Number(value.col);

  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return undefined;
  }

  return { row, col };
}

function normalizeWordsearchCellList(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const cells = value
    .map(normalizeWordsearchCell)
    .filter((entry): entry is WordsearchCell => Boolean(entry));

  return cells.length > 0 ? cells : undefined;
}

function normalizeWordsearchCellsById(
  value: unknown
): Record<string, WordsearchCell[]> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([wordId, cells]) => [wordId.trim(), normalizeWordsearchCellList(cells)] as const)
    .filter(
      (entry): entry is [string, WordsearchCell[]] =>
        entry[0].length > 0 && Array.isArray(entry[1]) && entry[1].length > 0
    );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeStringList(value: unknown) {
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

function normalizeCellKeyList(value: unknown) {
  return normalizeStringList(value).filter((entry) => /^\d+:\d+$/.test(entry));
}

function normalizeLetterCountLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "").length;
}

function getFallbackHintMessage(
  puzzleType: PuzzleType,
  index: number,
  options: {
    primaryAnswer?: string;
    hangmanCategory?: string;
    hangmanSolution?: string;
  } = {}
) {
  const t = getDictionary();

  switch (puzzleType) {
    case "text": {
      const answer = options.primaryAnswer ?? "";
      const letterCount = normalizeLetterCountLabel(answer);
      const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
      const normalizedLetters = answer
        .trim()
        .replace(/\s+/g, " ")
        .split("")
        .filter((character) => /[A-Za-zÀ-ÿ]/.test(character));

      const firstLetter = normalizedLetters[0] ?? "";
      const secondLetter = normalizedLetters[1] ?? "";
      const fallbacks = [
        t.step.assistTextLength.replace("{count}", String(letterCount)),
        firstLetter
          ? t.step.assistTextFirstLetter.replace("{letter}", firstLetter.toUpperCase())
          : t.step.assistGeneric,
        wordCount > 0
          ? t.step.assistTextWordCount.replace("{count}", String(wordCount))
          : t.step.assistGeneric,
        secondLetter
          ? t.step.assistTextSecondLetter.replace("{letter}", secondLetter.toUpperCase())
          : t.step.assistGeneric,
      ];

      return fallbacks[index] ?? t.step.assistGeneric;
    }
    case "hangman": {
      const solution = options.hangmanSolution ?? "";
      const letterCount = normalizeLetterCountLabel(solution);
      const firstLetter =
        solution
          .split("")
          .find((character) => /[A-Za-zÀ-ÿ]/.test(character))
          ?.toUpperCase() ?? "";
      const fallbacks = [
        options.hangmanCategory
          ? t.step.assistHangmanCategory.replace("{category}", options.hangmanCategory)
          : t.step.assistHangmanLength.replace("{count}", String(letterCount)),
        t.step.assistHangmanLength.replace("{count}", String(letterCount)),
        firstLetter
          ? t.step.assistHangmanFirstLetter.replace("{letter}", firstLetter)
          : t.step.assistGeneric,
      ];

      return fallbacks[index] ?? t.step.assistGeneric;
    }
    default:
      return t.step.assistGeneric;
  }
}

function cloneUiState(uiState?: StepAssistUiState): StepAssistUiState | undefined {
  if (!uiState) {
    return undefined;
  }

  return {
    revealedCellKeys: uiState.revealedCellKeys ? [...uiState.revealedCellKeys] : undefined,
    revealedSymbols: uiState.revealedSymbols ? [...uiState.revealedSymbols] : undefined,
    foundWordCellsById: uiState.foundWordCellsById
      ? Object.fromEntries(
          Object.entries(uiState.foundWordCellsById).map(([wordId, cells]) => [
            wordId,
            cells.map((cell) => ({ row: Number(cell.row), col: Number(cell.col) })),
          ])
        )
      : undefined,
    activeHintWordId: uiState.activeHintWordId,
    activeHintStartCell: uiState.activeHintStartCell
      ? {
          row: Number(uiState.activeHintStartCell.row),
          col: Number(uiState.activeHintStartCell.col),
        }
      : undefined,
    activeHintDirection: uiState.activeHintDirection,
    activeHintClueId: uiState.activeHintClueId,
    hintedWordIds: uiState.hintedWordIds ? [...uiState.hintedWordIds] : undefined,
    hintedClueIds: uiState.hintedClueIds ? [...uiState.hintedClueIds] : undefined,
  };
}

function cloneSnapshot(snapshot?: StepAssistanceSnapshot | null): StepAssistanceSnapshot {
  return {
    hintUses: Number(snapshot?.hintUses ?? 0),
    revealUsed: Boolean(snapshot?.revealUsed),
    penaltySeconds: Number(snapshot?.penaltySeconds ?? 0),
    hintPenaltySeconds: Number(snapshot?.hintPenaltySeconds ?? 0),
    revealPenaltySeconds: Number(snapshot?.revealPenaltySeconds ?? 0),
    hintMessages: [...(snapshot?.hintMessages ?? [])],
    assistedSubmission: snapshot?.assistedSubmission,
    uiState: cloneUiState(snapshot?.uiState),
  };
}

export function getDefaultStepAssistanceSnapshot(): StepAssistanceSnapshot {
  return cloneSnapshot();
}

export function readStepAssistanceConfig(rawPrivateData: unknown): StepAssistanceConfig {
  const rawConfig =
    isRecord(rawPrivateData) && isRecord(rawPrivateData.assistance)
      ? rawPrivateData.assistance
      : {};

  const smallHints = Array.isArray(rawConfig.smallHints)
    ? rawConfig.smallHints
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];

  return {
    maxSmallHints: clampPositiveInteger(
      rawConfig.maxSmallHints,
      DEFAULT_SMALL_HINTS,
      0,
      12
    ),
    hintPenaltySeconds: clampPositiveInteger(
      rawConfig.hintPenaltySeconds,
      DEFAULT_HINT_PENALTY_SECONDS,
      0,
      4 * 60 * 60
    ),
    revealPenaltySeconds: clampPositiveInteger(
      rawConfig.revealPenaltySeconds,
      DEFAULT_REVEAL_PENALTY_SECONDS,
      0,
      24 * 60 * 60
    ),
    smallHints,
    revealMessage:
      typeof rawConfig.revealMessage === "string" && rawConfig.revealMessage.trim().length > 0
        ? rawConfig.revealMessage.trim()
        : undefined,
  };
}

export function parseStoredStepAssistanceSnapshot(
  puzzleType: PuzzleType,
  raw: unknown
): StepAssistanceSnapshot {
  if (!isRecord(raw)) {
    return getDefaultStepAssistanceSnapshot();
  }

  const assistedSubmission = (() => {
    try {
      const storedSubmission = raw.assistedSubmission ?? raw.revealedSubmission;

      return storedSubmission
        ? parsePuzzleSubmission(puzzleType, storedSubmission)
        : undefined;
    } catch {
      return undefined;
    }
  })();

  const uiState: StepAssistUiState | undefined = isRecord(raw.uiState)
    ? {
        revealedCellKeys: normalizeCellKeyList(raw.uiState.revealedCellKeys),
        revealedSymbols: normalizeStringList(raw.uiState.revealedSymbols),
        foundWordCellsById: normalizeWordsearchCellsById(raw.uiState.foundWordCellsById),
        activeHintWordId:
          typeof raw.uiState.activeHintWordId === "string"
            ? raw.uiState.activeHintWordId.trim()
            : undefined,
        activeHintStartCell: normalizeWordsearchCell(raw.uiState.activeHintStartCell),
        activeHintDirection:
          raw.uiState.activeHintDirection === "up" ||
          raw.uiState.activeHintDirection === "down" ||
          raw.uiState.activeHintDirection === "left" ||
          raw.uiState.activeHintDirection === "right" ||
          raw.uiState.activeHintDirection === "up-left" ||
          raw.uiState.activeHintDirection === "up-right" ||
          raw.uiState.activeHintDirection === "down-left" ||
          raw.uiState.activeHintDirection === "down-right"
            ? raw.uiState.activeHintDirection
            : undefined,
        activeHintClueId:
          typeof raw.uiState.activeHintClueId === "string"
            ? raw.uiState.activeHintClueId.trim()
            : undefined,
        hintedWordIds: normalizeStringList(raw.uiState.hintedWordIds),
        hintedClueIds: normalizeStringList(raw.uiState.hintedClueIds),
      }
    : undefined;

  return {
    hintUses: clampPositiveInteger(raw.hintUses, 0, 0, 999),
    revealUsed: Boolean(raw.revealUsed),
    penaltySeconds: clampPositiveInteger(raw.penaltySeconds, 0, 0, 7 * 24 * 60 * 60),
    hintPenaltySeconds: clampPositiveInteger(raw.hintPenaltySeconds, 0, 0, 7 * 24 * 60 * 60),
    revealPenaltySeconds: clampPositiveInteger(
      raw.revealPenaltySeconds,
      0,
      0,
      7 * 24 * 60 * 60
    ),
    hintMessages: normalizeStringList(raw.hintMessages),
    assistedSubmission,
    uiState,
  };
}

function appendHintMessage(
  snapshot: StepAssistanceSnapshot,
  message: string,
  config: StepAssistanceConfig
) {
  const next = cloneSnapshot(snapshot);
  next.hintUses += 1;
  next.penaltySeconds += config.hintPenaltySeconds;
  next.hintPenaltySeconds += config.hintPenaltySeconds;
  next.hintMessages = [...next.hintMessages, message];
  return next;
}

function buildRevealState(
  snapshot: StepAssistanceSnapshot,
  assistedSubmission: PuzzleSubmission,
  uiState: StepAssistUiState | undefined,
  config: StepAssistanceConfig
) {
  const next = cloneSnapshot(snapshot);
  next.revealUsed = true;
  next.penaltySeconds += config.revealPenaltySeconds;
  next.revealPenaltySeconds += config.revealPenaltySeconds;
  next.assistedSubmission = assistedSubmission;
  next.uiState = uiState;
  return next;
}

function withUpdatedUiState(
  snapshot: StepAssistanceSnapshot,
  uiState: StepAssistUiState | undefined
) {
  const next = cloneSnapshot(snapshot);
  next.uiState = uiState;
  return next;
}

function createSudokuHint(
  publicData: SudokuPuzzlePublicData,
  privateData: SudokuPuzzlePrivateData,
  submission: SudokuSubmission,
  snapshot: StepAssistanceSnapshot,
  config: StepAssistanceConfig
): StepAssistResult {
  const t = getDictionary();
  const nextGrid = cloneSudokuGrid(submission.grid);
  let revealedCell: SudokuCell | null = null;

  for (let row = 0; row < privateData.solutionGrid.length; row += 1) {
    for (let column = 0; column < privateData.solutionGrid[row].length; column += 1) {
      if (Number(publicData.initialGrid[row]?.[column] ?? 0) > 0) {
        continue;
      }

      if (Number(nextGrid[row][column]) !== Number(privateData.solutionGrid[row][column])) {
        nextGrid[row][column] = Number(privateData.solutionGrid[row][column]);
        revealedCell = { row, column };
        break;
      }
    }

    if (revealedCell) {
      break;
    }
  }

  if (!revealedCell) {
    throw new Error("No small hints remaining for this step.");
  }

  const currentUiState = cloneUiState(snapshot.uiState) ?? {};
  const revealedKey = `${revealedCell.row}:${revealedCell.column}`;
  const nextUiState: StepAssistUiState = {
    ...currentUiState,
    revealedCellKeys: Array.from(
      new Set([...(currentUiState.revealedCellKeys ?? []), revealedKey])
    ),
  };
  const nextState = withUpdatedUiState(
    appendHintMessage(
      snapshot,
      t.step.assistSudokuCell
        .replace("{row}", String(revealedCell.row + 1))
        .replace("{column}", String(revealedCell.column + 1)),
      config
    ),
    nextUiState
  );
  nextState.assistedSubmission = {
    type: "sudoku",
    grid: nextGrid,
  };

  return {
    nextState,
    nextSubmission: {
      type: "sudoku",
      grid: nextGrid,
    },
    statusMessage: nextState.hintMessages[nextState.hintMessages.length - 1] ?? t.step.assistGeneric,
    penaltySecondsApplied: config.hintPenaltySeconds,
  };
}

function createAlphabetHint(
  publicData: AlphabetPuzzlePublicData,
  privateData: AlphabetPuzzlePrivateData,
  submission: AlphabetSubmission,
  snapshot: StepAssistanceSnapshot,
  config: StepAssistanceConfig
): StepAssistResult {
  const t = getDictionary();
  const symbolOrder = getAlphabetSymbolsInOrder(publicData.lines);
  const nextAssignments = { ...submission.assignments };
  const currentUiState = cloneUiState(snapshot.uiState) ?? {};
  const revealedSymbols = new Set(currentUiState.revealedSymbols ?? []);
  let revealedSymbol: string | null = null;

  for (const symbol of symbolOrder) {
    const solutionLetter = privateData.solutionMap[symbol];

    if (!solutionLetter || nextAssignments[symbol] === solutionLetter) {
      continue;
    }

    nextAssignments[symbol] = solutionLetter;
    revealedSymbols.add(symbol);
    revealedSymbol = symbol;
    break;
  }

  if (!revealedSymbol) {
    throw new Error("No small hints remaining for this step.");
  }

  const message = t.step.assistAlphabetMapping
    .replace("{symbol}", revealedSymbol)
    .replace("{letter}", nextAssignments[revealedSymbol]);
  const nextState = withUpdatedUiState(
    appendHintMessage(snapshot, message, config),
    {
      ...currentUiState,
      revealedSymbols: Array.from(revealedSymbols),
    }
  );
  nextState.assistedSubmission = {
    type: "alphabet",
    assignments: nextAssignments,
  };

  return {
    nextState,
    nextSubmission: {
      type: "alphabet",
      assignments: nextAssignments,
    },
    statusMessage: message,
    penaltySecondsApplied: config.hintPenaltySeconds,
  };
}

function createWordsearchHint(
  publicData: WordsearchPuzzlePublicData,
  privateData: WordsearchPuzzlePrivateData,
  submission: WordsearchSubmission,
  snapshot: StepAssistanceSnapshot,
  config: StepAssistanceConfig
): StepAssistResult {
  const t = getDictionary();
  const hintedWordIds = new Set(snapshot.uiState?.hintedWordIds ?? []);
  const foundSet = new Set(submission.foundWordIds);
  const targetWord = publicData.words.find(
    (word) => !foundSet.has(word.id) && !hintedWordIds.has(word.id)
  ) ?? publicData.words.find((word) => !foundSet.has(word.id));

  if (!targetWord) {
    throw new Error("No small hints remaining for this step.");
  }

  const placement = privateData.placements.find((entry) => entry.id === targetWord.id);

  if (!placement) {
    throw new Error("Wordsearch hint data is invalid.");
  }

  const cells = getWordsearchPlacementCells(placement);
  const startCell = cells[0];
  const endCell = cells[cells.length - 1];
  const direction: WordsearchDirection =
    startCell.row === endCell.row
      ? startCell.col < endCell.col
        ? "right"
        : "left"
      : startCell.col === endCell.col
        ? startCell.row < endCell.row
          ? "down"
          : "up"
        : startCell.row < endCell.row
          ? startCell.col < endCell.col
            ? "down-right"
            : "down-left"
          : startCell.col < endCell.col
            ? "up-right"
            : "up-left";

  const directionLabelMap: Record<WordsearchDirection, string> = {
    up: t.step.wordsearchDirectionUp,
    down: t.step.wordsearchDirectionDown,
    left: t.step.wordsearchDirectionLeft,
    right: t.step.wordsearchDirectionRight,
    "up-left": t.step.wordsearchDirectionUpLeft,
    "up-right": t.step.wordsearchDirectionUpRight,
    "down-left": t.step.wordsearchDirectionDownLeft,
    "down-right": t.step.wordsearchDirectionDownRight,
  };
  const message = t.step.assistWordsearchStart
    .replace("{word}", targetWord.label)
    .replace("{row}", String(startCell.row + 1))
    .replace("{column}", String(startCell.col + 1))
    .replace("{direction}", directionLabelMap[direction]);

  const nextState = withUpdatedUiState(
    appendHintMessage(snapshot, message, config),
    {
      ...cloneUiState(snapshot.uiState),
      activeHintWordId: targetWord.id,
      activeHintStartCell: startCell,
      activeHintDirection: direction,
      hintedWordIds: Array.from(new Set([...(snapshot.uiState?.hintedWordIds ?? []), targetWord.id])),
      activeHintClueId: undefined,
    }
  );

  return {
    nextState,
    nextSubmission: {
      type: "wordsearch",
      foundWordIds: [...submission.foundWordIds],
    },
    statusMessage: message,
    penaltySecondsApplied: config.hintPenaltySeconds,
  };
}

function createCrosswordHint(
  publicData: CrosswordPuzzlePublicData,
  privateData: CrosswordPuzzlePrivateData,
  submission: CrosswordSubmission,
  snapshot: StepAssistanceSnapshot,
  config: StepAssistanceConfig
): StepAssistResult {
  const t = getDictionary();
  const hintedClueIds = new Set(snapshot.uiState?.hintedClueIds ?? []);
  const orderedClues = getCrosswordCluesInOrder(publicData.clues);
  const nextCells = { ...submission.cells };
  const currentUiState = cloneUiState(snapshot.uiState) ?? {};
  const revealedKeys = new Set(currentUiState.revealedCellKeys ?? []);
  let targetClue = orderedClues.find((clue) => {
    const solution = privateData.solutions[clue.id];
    const firstCell = getCrosswordClueCells(clue)[0];
    const firstKey = `${firstCell.row}:${firstCell.col}`;
    return (
      !hintedClueIds.has(clue.id) &&
      solution &&
      nextCells[firstKey] !== solution[0]
    );
  });

  if (!targetClue) {
    targetClue = orderedClues.find((clue) => {
      const solution = privateData.solutions[clue.id];
      const firstCell = getCrosswordClueCells(clue)[0];
      const firstKey = `${firstCell.row}:${firstCell.col}`;
      return solution && nextCells[firstKey] !== solution[0];
    });
  }

  if (!targetClue) {
    throw new Error("No small hints remaining for this step.");
  }

  const solution = privateData.solutions[targetClue.id];

  if (!solution) {
    throw new Error("Crossword hint data is invalid.");
  }

  const firstCell = getCrosswordClueCells(targetClue)[0];
  const firstKey = `${firstCell.row}:${firstCell.col}`;
  nextCells[firstKey] = solution[0];
  revealedKeys.add(firstKey);

  const directionLabel =
    targetClue.direction === "across"
      ? t.step.crosswordDirectionAcross
      : t.step.crosswordDirectionDown;
  const message = t.step.assistCrosswordFirstLetter
    .replace("{number}", String(targetClue.number))
    .replace("{direction}", directionLabel);

  const nextState = withUpdatedUiState(
    appendHintMessage(snapshot, message, config),
    {
      ...currentUiState,
      revealedCellKeys: Array.from(revealedKeys),
      activeHintClueId: targetClue.id,
      hintedClueIds: Array.from(new Set([...(currentUiState.hintedClueIds ?? []), targetClue.id])),
    }
  );
  nextState.assistedSubmission = {
    type: "crossword",
    cells: nextCells,
  };

  return {
    nextState,
    nextSubmission: {
      type: "crossword",
      cells: nextCells,
    },
    statusMessage: message,
    penaltySecondsApplied: config.hintPenaltySeconds,
  };
}

function createTextReveal(
  privateData: TextPuzzlePrivateData,
  snapshot: StepAssistanceSnapshot,
  config: StepAssistanceConfig
): StepAssistResult {
  const t = getDictionary();
  const answer = privateData.acceptedAnswers[0] ?? "";
  const nextSubmission: PuzzleSubmission = {
    type: "text",
    answer,
  };
  const nextState = buildRevealState(snapshot, nextSubmission, undefined, config);

  return {
    nextState,
    nextSubmission,
    statusMessage: config.revealMessage ?? t.step.assistRevealApplied,
    penaltySecondsApplied: config.revealPenaltySeconds,
  };
}

function createHangmanReveal(
  publicData: HangmanPuzzlePublicData,
  privateData: HangmanPuzzlePrivateData,
  snapshot: StepAssistanceSnapshot,
  config: StepAssistanceConfig
): StepAssistResult {
  const t = getDictionary();
  const solvedPreview = buildHangmanPreview(
    privateData.solution,
    privateData.solution.split(""),
    publicData.maxWrongGuesses
  );
  const nextSubmission: PuzzleSubmission = {
    type: "hangman",
    guessedLetters: solvedPreview.guessedLetters,
  };
  const nextState = buildRevealState(snapshot, nextSubmission, undefined, config);

  return {
    nextState,
    nextSubmission,
    statusMessage: config.revealMessage ?? t.step.assistRevealApplied,
    penaltySecondsApplied: config.revealPenaltySeconds,
  };
}

function createSudokuReveal(
  publicData: SudokuPuzzlePublicData,
  privateData: SudokuPuzzlePrivateData,
  snapshot: StepAssistanceSnapshot,
  config: StepAssistanceConfig
): StepAssistResult {
  const t = getDictionary();
  const nextSubmission: PuzzleSubmission = {
    type: "sudoku",
    grid: cloneSudokuGrid(privateData.solutionGrid),
  };
  const revealedCellKeys: string[] = [];

  for (let row = 0; row < privateData.solutionGrid.length; row += 1) {
    for (let column = 0; column < privateData.solutionGrid[row].length; column += 1) {
      if (Number(publicData.initialGrid[row]?.[column] ?? 0) === 0) {
        revealedCellKeys.push(`${row}:${column}`);
      }
    }
  }

  const nextState = buildRevealState(
    snapshot,
    nextSubmission,
    {
      ...cloneUiState(snapshot.uiState),
      revealedCellKeys,
    },
    config
  );

  return {
    nextState,
    nextSubmission,
    statusMessage: config.revealMessage ?? t.step.assistRevealApplied,
    penaltySecondsApplied: config.revealPenaltySeconds,
  };
}

function createAlphabetReveal(
  publicData: AlphabetPuzzlePublicData,
  privateData: AlphabetPuzzlePrivateData,
  snapshot: StepAssistanceSnapshot,
  config: StepAssistanceConfig
): StepAssistResult {
  const t = getDictionary();
  const nextSubmission: PuzzleSubmission = {
    type: "alphabet",
    assignments: { ...privateData.solutionMap },
  };
  const nextState = buildRevealState(
    snapshot,
    nextSubmission,
    {
      ...cloneUiState(snapshot.uiState),
      revealedSymbols: getAlphabetSymbolsInOrder(publicData.lines),
    },
    config
  );

  return {
    nextState,
    nextSubmission,
    statusMessage: config.revealMessage ?? t.step.assistRevealApplied,
    penaltySecondsApplied: config.revealPenaltySeconds,
  };
}

function createWordsearchReveal(
  publicData: WordsearchPuzzlePublicData,
  privateData: WordsearchPuzzlePrivateData,
  snapshot: StepAssistanceSnapshot,
  config: StepAssistanceConfig
): StepAssistResult {
  const t = getDictionary();
  const nextSubmission: PuzzleSubmission = {
    type: "wordsearch",
    foundWordIds: publicData.words.map((word) => word.id),
  };
  const foundWordCellsById = Object.fromEntries(
    privateData.placements.map((placement) => [
      placement.id,
      getWordsearchPlacementCells(placement),
    ])
  );
  const nextState = buildRevealState(
    snapshot,
    nextSubmission,
    {
      ...cloneUiState(snapshot.uiState),
      foundWordCellsById,
      activeHintWordId: undefined,
      activeHintStartCell: undefined,
      activeHintDirection: undefined,
    },
    config
  );

  return {
    nextState,
    nextSubmission,
    statusMessage: config.revealMessage ?? t.step.assistRevealApplied,
    penaltySecondsApplied: config.revealPenaltySeconds,
  };
}

function createCrosswordReveal(
  publicData: CrosswordPuzzlePublicData,
  privateData: CrosswordPuzzlePrivateData,
  snapshot: StepAssistanceSnapshot,
  config: StepAssistanceConfig
): StepAssistResult {
  const t = getDictionary();
  const nextCells: Record<string, string> = {};
  const revealedCellKeys: string[] = [];

  publicData.clues.forEach((clue) => {
    const solution = privateData.solutions[clue.id] ?? "";
    getCrosswordClueCells(clue).forEach((cell, index) => {
      const key = `${cell.row}:${cell.col}`;
      const letter = solution[index] ?? "";

      if (letter) {
        nextCells[key] = letter;
        revealedCellKeys.push(key);
      }
    });
  });

  const nextSubmission: PuzzleSubmission = {
    type: "crossword",
    cells: nextCells,
  };
  const nextState = buildRevealState(
    snapshot,
    nextSubmission,
    {
      ...cloneUiState(snapshot.uiState),
      revealedCellKeys: Array.from(new Set(revealedCellKeys)),
      activeHintClueId: undefined,
    },
    config
  );

  return {
    nextState,
    nextSubmission,
    statusMessage: config.revealMessage ?? t.step.assistRevealApplied,
    penaltySecondsApplied: config.revealPenaltySeconds,
  };
}

export function applyStepAssistance(args: {
  action: StepAssistAction;
  puzzleType: PuzzleType;
  publicPuzzle: ParsedPublicPuzzle;
  privatePuzzle: ParsedPrivatePuzzle;
  submission: PuzzleSubmission;
  currentState?: StepAssistanceSnapshot | null;
  rawPrivateData?: unknown;
}): StepAssistResult {
  const t = getDictionary();
  const config = readStepAssistanceConfig(args.rawPrivateData);
  const currentState = cloneSnapshot(args.currentState);

  if (args.action === "hint") {
    if (currentState.revealUsed) {
      throw new Error(t.step.assistRevealAlreadyUsed);
    }

    if (currentState.hintUses >= config.maxSmallHints) {
      throw new Error(t.step.assistNoHintsRemaining);
    }

    const authoredHint = config.smallHints[currentState.hintUses];

    if (authoredHint) {
      const nextState = appendHintMessage(currentState, authoredHint, config);
      return {
        nextState,
        nextSubmission: args.submission,
        statusMessage: authoredHint,
        penaltySecondsApplied: config.hintPenaltySeconds,
      };
    }
  } else if (currentState.revealUsed) {
    throw new Error(t.step.assistRevealAlreadyUsed);
  }

  switch (args.puzzleType) {
    case "text": {
      if (args.publicPuzzle.type !== "text" || args.privatePuzzle.type !== "text" || args.submission.type !== "text") {
        throw new Error("Text puzzle data is invalid.");
      }

      if (args.action === "reveal") {
        return createTextReveal(args.privatePuzzle.data, currentState, config);
      }

      const primaryAnswer = args.privatePuzzle.data.acceptedAnswers[0] ?? "";
      const fallbackIndex = currentState.hintUses - config.smallHints.length;
      const message = getFallbackHintMessage("text", fallbackIndex, {
        primaryAnswer,
      });
      const nextState = appendHintMessage(currentState, message, config);
      return {
        nextState,
        nextSubmission: args.submission,
        statusMessage: message,
        penaltySecondsApplied: config.hintPenaltySeconds,
      };
    }
    case "hangman": {
      if (
        args.publicPuzzle.type !== "hangman" ||
        args.privatePuzzle.type !== "hangman" ||
        args.submission.type !== "hangman"
      ) {
        throw new Error("Hangman puzzle data is invalid.");
      }

      if (args.action === "reveal") {
        return createHangmanReveal(
          args.publicPuzzle.data,
          args.privatePuzzle.data,
          currentState,
          config
        );
      }

      const fallbackIndex = currentState.hintUses - config.smallHints.length;

      if (fallbackIndex === 0) {
        const message = getFallbackHintMessage("hangman", fallbackIndex, {
          hangmanCategory: args.publicPuzzle.data.category,
          hangmanSolution: args.privatePuzzle.data.solution,
        });
        const nextState = appendHintMessage(currentState, message, config);
        return {
          nextState,
          nextSubmission: args.submission,
          statusMessage: message,
          penaltySecondsApplied: config.hintPenaltySeconds,
        };
      }

      const preview = buildHangmanPreview(
        args.privatePuzzle.data.solution,
        args.submission.guessedLetters,
        args.publicPuzzle.data.maxWrongGuesses
      );
      const solutionLetters = Array.from(
        new Set(
          args.privatePuzzle.data.solution
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .split("")
            .filter((character) => /^[A-Z]$/.test(character))
        )
      );
      const nextLetter = solutionLetters.find(
        (letter) => !preview.guessedLetters.includes(letter)
      );

      if (!nextLetter) {
        throw new Error(t.step.assistNoHintsRemaining);
      }

      const nextSubmission: HangmanSubmission = {
        type: "hangman",
        guessedLetters: Array.from(
          new Set([...args.submission.guessedLetters, nextLetter])
        ),
      };
      const message = t.step.assistHangmanLetter.replace("{letter}", nextLetter);
      const nextState = appendHintMessage(currentState, message, config);
      nextState.assistedSubmission = nextSubmission;

      return {
        nextState,
        nextSubmission,
        statusMessage: message,
        penaltySecondsApplied: config.hintPenaltySeconds,
      };
    }
    case "sudoku":
      if (
        args.publicPuzzle.type !== "sudoku" ||
        args.privatePuzzle.type !== "sudoku" ||
        args.submission.type !== "sudoku"
      ) {
        throw new Error("Sudoku puzzle data is invalid.");
      }

      return args.action === "reveal"
        ? createSudokuReveal(
            args.publicPuzzle.data,
            args.privatePuzzle.data,
            currentState,
            config
          )
        : createSudokuHint(
            args.publicPuzzle.data,
            args.privatePuzzle.data,
            args.submission,
            currentState,
            config
          );
    case "alphabet":
      if (
        args.publicPuzzle.type !== "alphabet" ||
        args.privatePuzzle.type !== "alphabet" ||
        args.submission.type !== "alphabet"
      ) {
        throw new Error("Alphabet puzzle data is invalid.");
      }

      return args.action === "reveal"
        ? createAlphabetReveal(
            args.publicPuzzle.data,
            args.privatePuzzle.data,
            currentState,
            config
          )
        : createAlphabetHint(
            args.publicPuzzle.data,
            args.privatePuzzle.data,
            args.submission,
            currentState,
            config
          );
    case "wordsearch":
      if (
        args.publicPuzzle.type !== "wordsearch" ||
        args.privatePuzzle.type !== "wordsearch" ||
        args.submission.type !== "wordsearch"
      ) {
        throw new Error("Wordsearch puzzle data is invalid.");
      }

      return args.action === "reveal"
        ? createWordsearchReveal(
            args.publicPuzzle.data,
            args.privatePuzzle.data,
            currentState,
            config
          )
        : createWordsearchHint(
            args.publicPuzzle.data,
            args.privatePuzzle.data,
            args.submission,
            currentState,
            config
          );
    case "crossword":
      if (
        args.publicPuzzle.type !== "crossword" ||
        args.privatePuzzle.type !== "crossword" ||
        args.submission.type !== "crossword"
      ) {
        throw new Error("Crossword puzzle data is invalid.");
      }

      return args.action === "reveal"
        ? createCrosswordReveal(
            args.publicPuzzle.data,
            args.privatePuzzle.data,
            currentState,
            config
          )
        : createCrosswordHint(
            args.publicPuzzle.data,
            args.privatePuzzle.data,
            args.submission,
            currentState,
            config
          );
  }
}
