const DRAFT_STORAGE_PREFIX = "geoquest:draft:";

export type QuestDraft = {
  questAccessId: string;
  stepDocumentId: string;
  answer: string;
  savedAt: number;
};

function hasWindow() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getDraftKey(questAccessId: string, stepDocumentId: string) {
  return `${DRAFT_STORAGE_PREFIX}${questAccessId}:${stepDocumentId}`;
}

export function loadQuestDraft(
  questAccessId: string,
  stepDocumentId: string
): QuestDraft | null {
  if (!hasWindow()) {
    return null;
  }

  const raw = window.localStorage.getItem(getDraftKey(questAccessId, stepDocumentId));

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as QuestDraft;
  } catch {
    return null;
  }
}

export function saveQuestDraft(
  questAccessId: string,
  stepDocumentId: string,
  answer: string
) {
  if (!hasWindow()) {
    return;
  }

  const draft: QuestDraft = {
    questAccessId,
    stepDocumentId,
    answer,
    savedAt: Date.now(),
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
