import { createHash, randomBytes } from "crypto";
import type { NextResponse } from "next/server";
import {
  StrapiEntity,
  getCmsUrl,
  getStrapiApiToken,
  unwrapStrapiEntity,
} from "@/lib/purchases/questPurchaseWorkflow";
import { getDictionary } from "@/lib/i18n";
import {
  buildHangmanPreview,
  evaluateSudokuGrid,
  parsePrivatePuzzleData,
  parsePublicPuzzleData,
  parsePuzzleSubmission,
  validateHangmanSubmission,
  validateSudokuSubmission,
  validateTextSubmission,
  type HangmanPreview,
  type PuzzleSubmission,
  type SudokuEvaluation,
} from "@/lib/quests/puzzleTypes";

export const QUEST_SESSION_COOKIE_NAME = "gq_session";

const SESSION_IDLE_MS = 90 * 24 * 60 * 60 * 1000;
const STEP_RESTART_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const QUEST_ACCESS_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const PROGRESS_LOCK_TTL_MS = 15 * 1000;
const LIFECYCLE_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

type CookieStore = {
  get(name: string): { value: string } | undefined;
};

type StrapiListResponse<T> = {
  data?: Array<StrapiEntity<T>>;
};

type StrapiSingleResponse<T> = {
  data?: StrapiEntity<T>;
};

export type PlayerSessionStatus = "active" | "revoked" | "expired";
export type QuestAccessStatus = "active" | "revoked";
export type QuestProgressStatus = "active" | "completed";

export type PlayerSessionData = {
  tokenHash: string;
  status: PlayerSessionStatus;
  lastSeenAt?: string | null;
  expiresAt?: string | null;
};

export type QuestCoverImage = {
  url: string;
  alternativeText?: string | null;
};

export type QuestAccessQuestData = {
  title: string;
  slug: string;
  description?: string | null;
  city?: string | null;
  difficulty?: string | null;
  duration?: string | null;
  coverImage?: QuestCoverImage | null;
};

export type QuestProgressData = {
  currentStepDocumentId: string;
  currentStepOrder: number;
  completedStepOrders?: number[] | null;
  status: QuestProgressStatus;
  currentStepStartedAt?: string | null;
  lastActiveAt: string;
  lastCheckpointAt: string;
  version: number;
};

export type QuestProgressLockData = {
  progressKey: string;
  expiresAt: string;
};

export type QuestAccessData = {
  status: QuestAccessStatus;
  firstRedeemedAt: string;
  lastOpenedAt?: string | null;
  lastRecoveredAt?: string | null;
  recoveryCount?: number | null;
  quest?: unknown;
  currentPlayerSession?: unknown;
  progress?: unknown;
  questPurchase?: unknown;
};

export type QuestPurchaseData = {
  buyerEmail?: string;
  purchaseStatus?: "pending" | "paid" | "redeemed";
  redemptionCode?: string;
  quest?: unknown;
  questAccess?: unknown;
};

export type QuestStepData = {
  documentId?: string;
  order: number;
  title?: string | null;
  flavorText?: string | null;
  successText?: string | null;
  updatedAt?: string | null;
  latitude: number | string;
  longitude: number | string;
  radiusMeters: number | string;
  puzzleType: string;
  puzzleDataPublic?: Record<string, unknown> | null;
  puzzleDataPrivate?: Record<string, unknown> | null;
  quest?: unknown;
};

export type OwnedQuestSummary = {
  questAccessId: string;
  questTitle: string;
  questSlug: string;
  questDescription?: string | null;
  questCity?: string | null;
  questDifficulty?: string | null;
  questDuration?: string | null;
  coverImage?: QuestCoverImage | null;
  progressStatus: QuestProgressStatus;
  currentStepDocumentId: string;
  currentStepOrder: number;
  completedStepOrders: number[];
  completedStepsCount: number;
  version: number;
  recovered: boolean;
  restartCurrentStep: boolean;
  warningMessage?: string;
  firstRedeemedAt: string;
  lastOpenedAt?: string | null;
  lastCheckpointAt: string;
  playHref: string;
  stepHref: string;
};

export type PlayerSessionContext = {
  token: string;
  expiresAt: Date;
  session: StrapiEntity<PlayerSessionData>;
  created: boolean;
};

export type RedeemQuestResult = {
  recovered: boolean;
  summary: OwnedQuestSummary;
  session: PlayerSessionContext;
};

export type SubmissionAdvanceResult = {
  ok: true;
  unlocked: boolean;
  questCompleted: boolean;
  nextStepDocumentId: string | null;
  nextStepOrder: number | null;
  version: number;
  checks: {
    locationOk: boolean;
    answerOk: boolean;
    distanceMeters: number;
    radiusMeters: number;
    bufferMeters: number;
    effectiveRadiusMeters: number;
    accuracyMeters: number;
  };
};

const lifecycleStore = globalThis as typeof globalThis & {
  __geoQuestLifecycleSweepAt__?: number;
};

function now() {
  return new Date();
}

function sessionExpiryDate(at: Date) {
  return new Date(at.getTime() + SESSION_IDLE_MS);
}

function hasStepGoneStale(lastActiveAt?: string | null, lastCheckpointAt?: string | null) {
  const activityTimestamp = lastActiveAt ?? lastCheckpointAt;

  if (!activityTimestamp) {
    return false;
  }

  const activityDate = new Date(activityTimestamp);
  if (Number.isNaN(activityDate.getTime())) {
    return false;
  }

  return now().getTime() - activityDate.getTime() > STEP_RESTART_AFTER_MS;
}

function buildRestartWarning() {
  return getDictionary().play.restartWarning;
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function applyQuestSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date
) {
  response.cookies.set({
    name: QUEST_SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearQuestSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: QUEST_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

function getEntityIdentifier(entity: { documentId?: string; id?: number } | null | undefined) {
  if (!entity) {
    return null;
  }

  return entity.documentId ?? (typeof entity.id === "number" ? String(entity.id) : null);
}

function unwrapRelationEntity<T>(relation: unknown) {
  if (!relation || typeof relation !== "object") {
    return null;
  }

  const maybeData = (relation as { data?: StrapiEntity<T> | null }).data;
  return unwrapStrapiEntity<T>((maybeData ?? relation) as StrapiEntity<T>);
}

function getRelationEntity<T>(relation: unknown) {
  if (!relation || typeof relation !== "object") {
    return null;
  }

  const maybeData = (relation as { data?: StrapiEntity<T> | null }).data;
  return (maybeData ?? relation) as StrapiEntity<T> | null;
}

function normalizeCompletedSteps(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry))
    .sort((a, b) => a - b);
}

async function strapiRequest(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${getStrapiApiToken()}`);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${getCmsUrl()}/api${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

async function strapiJson<T>(path: string, init?: RequestInit) {
  const res = await strapiRequest(path, init);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strapi request failed (${res.status}) ${path}\n${body}`);
  }

  return (await res.json()) as T;
}

async function strapiCreate<T>(collectionPath: string, data: Record<string, unknown>) {
  return strapiJson<StrapiSingleResponse<T>>(collectionPath, {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

async function strapiUpdate<T>(
  collectionPath: string,
  identifier: string,
  data: Record<string, unknown>
) {
  return strapiJson<StrapiSingleResponse<T>>(`${collectionPath}/${identifier}`, {
    method: "PUT",
    body: JSON.stringify({ data }),
  });
}

async function strapiDelete(collectionPath: string, identifier: string) {
  const response = await strapiRequest(`${collectionPath}/${identifier}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Strapi delete failed (${response.status}) ${collectionPath}/${identifier}\n${body}`);
  }
}

async function findPlayerSessionByTokenHash(tokenHash: string) {
  const json = await strapiJson<StrapiListResponse<PlayerSessionData>>(
    `/player-sessions?filters[tokenHash][$eq]=${encodeURIComponent(tokenHash)}&pagination[pageSize]=1`
  );

  return json.data?.[0] ?? null;
}

async function createPlayerSession(token: string) {
  const sessionCreatedAt = now();
  const expiresAt = sessionExpiryDate(sessionCreatedAt);
  const created = await strapiCreate<PlayerSessionData>("/player-sessions", {
    tokenHash: hashSessionToken(token),
    status: "active",
    lastSeenAt: sessionCreatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  if (!created.data) {
    throw new Error("Failed to create player session");
  }

  return {
    token,
    expiresAt,
    session: created.data,
    created: true,
  } satisfies PlayerSessionContext;
}

async function touchPlayerSession(
  session: StrapiEntity<PlayerSessionData>,
  token: string
) {
  const touchedAt = now();
  const expiresAt = sessionExpiryDate(touchedAt);
  const identifier = getEntityIdentifier(session);

  if (!identifier) {
    throw new Error("Missing player session identifier");
  }

  const updated = await strapiUpdate<PlayerSessionData>("/player-sessions", identifier, {
    status: "active",
    lastSeenAt: touchedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  if (!updated.data) {
    throw new Error("Failed to update player session");
  }

  return {
    token,
    expiresAt,
    session: updated.data,
    created: false,
  } satisfies PlayerSessionContext;
}

async function markPlayerSessionExpired(session: StrapiEntity<PlayerSessionData>) {
  const identifier = getEntityIdentifier(session);

  if (!identifier) {
    return;
  }

  await strapiUpdate<PlayerSessionData>("/player-sessions", identifier, {
    status: "expired",
  });
}

function isSessionExpired(session: StrapiEntity<PlayerSessionData>) {
  const data = unwrapStrapiEntity<PlayerSessionData>(session);

  if (!data || data.status !== "active") {
    return true;
  }

  if (!data.expiresAt) {
    return false;
  }

  return new Date(data.expiresAt).getTime() <= now().getTime();
}

export async function resolvePlayerSessionFromCookies(cookieStore: CookieStore) {
  const token = cookieStore.get(QUEST_SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await findPlayerSessionByTokenHash(hashSessionToken(token));

  if (!session) {
    return null;
  }

  if (isSessionExpired(session)) {
    await markPlayerSessionExpired(session);
    return null;
  }

  return {
    token,
    session,
  };
}

export async function getActivePlayerSessionFromCookies(
  cookieStore: CookieStore,
  options?: { touch?: boolean }
) {
  const existing = await resolvePlayerSessionFromCookies(cookieStore);

  if (!existing) {
    return null;
  }

  if (options?.touch) {
    return touchPlayerSession(existing.session, existing.token);
  }

  const sessionData = unwrapStrapiEntity<PlayerSessionData>(existing.session);
  const expiresAt = sessionData?.expiresAt
    ? new Date(sessionData.expiresAt)
    : sessionExpiryDate(now());

  return {
    token: existing.token,
    expiresAt,
    session: existing.session,
    created: false,
  } satisfies PlayerSessionContext;
}

export async function ensurePlayerSession(cookieStore: CookieStore) {
  await maybeRunLifecycleMaintenance();

  const existing = await resolvePlayerSessionFromCookies(cookieStore);

  if (existing) {
    return touchPlayerSession(existing.session, existing.token);
  }

  return createPlayerSession(createSessionToken());
}

async function fetchQuestPurchaseByCode(code: string) {
  const json = await strapiJson<StrapiListResponse<QuestPurchaseData>>(
    `/quest-purchases?filters[redemptionCode][$eq]=${encodeURIComponent(
      code
    )}&populate[quest]=true&populate[questAccess][populate][progress]=true&populate[questAccess][populate][currentPlayerSession]=true&pagination[pageSize]=1`
  );

  return json.data?.[0] ?? null;
}

async function fetchQuestAccessByQuestPurchaseId(questPurchaseId: string) {
  const json = await strapiJson<StrapiListResponse<QuestAccessData>>(
    `/quest-accesses?filters[questPurchase][documentId][$eq]=${encodeURIComponent(
      questPurchaseId
    )}&populate[quest][populate]=coverImage&populate[progress]=true&populate[currentPlayerSession]=true&populate[questPurchase]=true&pagination[pageSize]=1`
  );

  return json.data?.[0] ?? null;
}

async function fetchQuestAccessById(questAccessId: string) {
  const json = await strapiJson<StrapiSingleResponse<QuestAccessData>>(
    `/quest-accesses/${encodeURIComponent(
      questAccessId
    )}?populate[quest][populate]=coverImage&populate[progress]=true&populate[currentPlayerSession]=true&populate[questPurchase]=true`
  );

  return json.data ?? null;
}

async function fetchQuestAccessesBySession(sessionId: string) {
  const json = await strapiJson<StrapiListResponse<QuestAccessData>>(
    `/quest-accesses?filters[currentPlayerSession][documentId][$eq]=${encodeURIComponent(
      sessionId
    )}&filters[status][$eq]=active&populate[quest][populate]=coverImage&populate[progress]=true&populate[questPurchase]=true&sort[0]=lastOpenedAt:desc&sort[1]=createdAt:desc`
  );

  return json.data ?? [];
}

async function fetchQuestAccessForSessionByQuestSlug(sessionId: string, questSlug: string) {
  const json = await strapiJson<StrapiListResponse<QuestAccessData>>(
    `/quest-accesses?filters[currentPlayerSession][documentId][$eq]=${encodeURIComponent(
      sessionId
    )}&filters[quest][slug][$eq]=${encodeURIComponent(
      questSlug
    )}&filters[status][$eq]=active&populate[quest][populate]=coverImage&populate[progress]=true&populate[questPurchase]=true&pagination[pageSize]=1`
  );

  return json.data?.[0] ?? null;
}

async function fetchQuestStepByQuestAndOrder(
  questDocumentId: string,
  order: number,
  includePrivate = false
) {
  const populate = includePrivate ? "&populate=quest" : "";
  const json = await strapiJson<StrapiListResponse<QuestStepData>>(
    `/quest-steps?filters[quest][documentId][$eq]=${encodeURIComponent(
      questDocumentId
    )}&filters[order][$eq]=${order}&pagination[pageSize]=1${populate}`
  );

  return json.data?.[0] ?? null;
}

async function fetchQuestStepByDocumentId(stepDocumentId: string, includePrivate = false) {
  const populate = includePrivate ? "?populate=quest" : "";
  const json = await strapiJson<StrapiSingleResponse<QuestStepData>>(
    `/quest-steps/${encodeURIComponent(stepDocumentId)}${populate}`
  );

  return json.data ?? null;
}

async function fetchQuestProgressLockByProgressKey(progressKey: string) {
  const json = await strapiJson<StrapiListResponse<QuestProgressLockData>>(
    `/quest-progress-locks?filters[progressKey][$eq]=${encodeURIComponent(
      progressKey
    )}&pagination[pageSize]=1`
  );

  return json.data?.[0] ?? null;
}

async function fetchExpiredPlayerSessions(nowIso: string) {
  const json = await strapiJson<StrapiListResponse<PlayerSessionData>>(
    `/player-sessions?filters[status][$eq]=active&filters[expiresAt][$lt]=${encodeURIComponent(
      nowIso
    )}&pagination[pageSize]=25`
  );

  return json.data ?? [];
}

async function fetchRetainedQuestAccesses(cutoffIso: string) {
  const [inactive, neverOpened] = await Promise.all([
    strapiJson<StrapiListResponse<QuestAccessData>>(
      `/quest-accesses?filters[lastOpenedAt][$lt]=${encodeURIComponent(
        cutoffIso
      )}&pagination[pageSize]=25&populate=progress`
    ),
    strapiJson<StrapiListResponse<QuestAccessData>>(
      `/quest-accesses?filters[lastOpenedAt][$null]=true&filters[firstRedeemedAt][$lt]=${encodeURIComponent(
        cutoffIso
      )}&pagination[pageSize]=25&populate=progress`
    ),
  ]);

  const deduped = new Map<string, StrapiEntity<QuestAccessData>>();

  for (const access of [...(inactive.data ?? []), ...(neverOpened.data ?? [])]) {
    const identifier = getEntityIdentifier(access);
    if (identifier) {
      deduped.set(identifier, access);
    }
  }

  return Array.from(deduped.values());
}

async function tryCreateQuestProgressLock(progressKey: string, expiresAtIso: string) {
  const response = await strapiRequest("/quest-progress-locks", {
    method: "POST",
    body: JSON.stringify({
      data: {
        progressKey,
        expiresAt: expiresAtIso,
      },
    }),
  });

  if (response.ok) {
    return (await response.json()) as StrapiSingleResponse<QuestProgressLockData>;
  }

  const body = await response.text();
  return {
    response,
    body,
  };
}

function isQuestProgressLockExpired(lock: StrapiEntity<QuestProgressLockData> | null) {
  const data = unwrapStrapiEntity<QuestProgressLockData>(lock);

  if (!data?.expiresAt) {
    return false;
  }

  return new Date(data.expiresAt).getTime() <= now().getTime();
}

async function acquireQuestProgressLock(progressKey: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const expiresAtIso = new Date(now().getTime() + PROGRESS_LOCK_TTL_MS).toISOString();
    const created = await tryCreateQuestProgressLock(progressKey, expiresAtIso);

    if ("data" in created && created.data) {
      return created.data;
    }

    const existing = await fetchQuestProgressLockByProgressKey(progressKey);

    if (existing && isQuestProgressLockExpired(existing)) {
      const existingId = getEntityIdentifier(existing);

      if (existingId) {
        await strapiDelete("/quest-progress-locks", existingId).catch(() => {
          // Another request may have cleaned it up first.
        });
      }

      continue;
    }

    throw new Error("Quest progress is being updated. Please reload and try again.");
  }

  throw new Error("Quest progress is being updated. Please reload and try again.");
}

async function releaseQuestProgressLock(lock: StrapiEntity<QuestProgressLockData> | null) {
  const identifier = getEntityIdentifier(lock);

  if (!identifier) {
    return;
  }

  await strapiDelete("/quest-progress-locks", identifier).catch(() => {
    // Best-effort cleanup for short-lived mutation locks.
  });
}

async function expireInactivePlayerSessions() {
  const expired = await fetchExpiredPlayerSessions(now().toISOString());

  await Promise.all(
    expired.map(async (session) => {
      const identifier = getEntityIdentifier(session);

      if (!identifier) {
        return;
      }

      await strapiUpdate<PlayerSessionData>("/player-sessions", identifier, {
        status: "expired",
      }).catch(() => {
        // Best-effort lifecycle cleanup.
      });
    })
  );
}

async function purgeStaleQuestAccesses() {
  const cutoffIso = new Date(now().getTime() - QUEST_ACCESS_RETENTION_MS).toISOString();
  const accesses = await fetchRetainedQuestAccesses(cutoffIso);

  await Promise.all(
    accesses.map(async (access) => {
      const accessId = getEntityIdentifier(access);
      const accessData = unwrapStrapiEntity<QuestAccessData>(access);
      const progress = getRelationEntity<QuestProgressData>(accessData?.progress);
      const progressId = getEntityIdentifier(progress);

      if (progressId) {
        await strapiDelete("/quest-progresses", progressId).catch(() => {
          // Best-effort lifecycle cleanup.
        });
      }

      if (accessId) {
        await strapiDelete("/quest-accesses", accessId).catch(() => {
          // Best-effort lifecycle cleanup.
        });
      }
    })
  );
}

async function maybeRunLifecycleMaintenance(force = false) {
  const currentTime = Date.now();
  const lastSweepAt = lifecycleStore.__geoQuestLifecycleSweepAt__ ?? 0;

  if (!force && currentTime - lastSweepAt < LIFECYCLE_SWEEP_INTERVAL_MS) {
    return;
  }

  lifecycleStore.__geoQuestLifecycleSweepAt__ = currentTime;

  try {
    await expireInactivePlayerSessions();
    await purgeStaleQuestAccesses();
  } catch {
    // Best-effort maintenance should never block the user flow.
  }
}

async function createQuestProgress(
  questAccessId: string,
  firstStep: StrapiEntity<QuestStepData>
) {
  const firstStepData = unwrapStrapiEntity<QuestStepData>(firstStep);
  const firstStepId = getEntityIdentifier(firstStep);

  if (!firstStepData || !firstStepId) {
    throw new Error("Missing first quest step");
  }

  const createdAt = now().toISOString();
  const created = await strapiCreate<QuestProgressData>("/quest-progresses", {
    questAccess: questAccessId,
    currentStepDocumentId: firstStepId,
    currentStepOrder: Number(firstStepData.order),
    completedStepOrders: [],
    status: "active",
    currentStepStartedAt: createdAt,
    lastActiveAt: createdAt,
    lastCheckpointAt: createdAt,
    version: 1,
  });

  if (!created.data) {
    throw new Error("Failed to create quest progress");
  }

  return created.data;
}

async function createQuestAccessForPurchase(
  purchase: StrapiEntity<QuestPurchaseData>,
  session: StrapiEntity<PlayerSessionData>
) {
  const purchaseData = unwrapStrapiEntity<QuestPurchaseData>(purchase);
  const purchaseId = getEntityIdentifier(purchase);
  const questEntity = getRelationEntity<QuestAccessQuestData>(purchaseData?.quest);
  const questData = unwrapRelationEntity<QuestAccessQuestData>(purchaseData?.quest);
  const questId = getEntityIdentifier(questEntity);

  if (!purchaseData || !purchaseId || !questData || !questId) {
    throw new Error("Purchase is missing quest information");
  }

  const firstStep = await fetchQuestStepByQuestAndOrder(questId, 1);
  const firstStepId = getEntityIdentifier(firstStep);

  if (!firstStep || !firstStepId) {
    throw new Error("Quest has no first step");
  }

  const createdAt = now().toISOString();
  const sessionId = getEntityIdentifier(session);

  if (!sessionId) {
    throw new Error("Missing player session identifier");
  }

  const created = await strapiCreate<QuestAccessData>("/quest-accesses", {
    questPurchase: purchaseId,
    quest: questId,
    currentPlayerSession: sessionId,
    status: "active",
    firstRedeemedAt: createdAt,
    lastOpenedAt: createdAt,
    recoveryCount: 0,
  });

  if (!created.data) {
    throw new Error("Failed to create quest access");
  }

  const createdAccessId = getEntityIdentifier(created.data);

  if (!createdAccessId) {
    throw new Error("Created quest access is missing an identifier");
  }

  await createQuestProgress(createdAccessId, firstStep);

  return fetchQuestAccessById(createdAccessId);
}

async function touchQuestAccess(access: StrapiEntity<QuestAccessData>) {
  const identifier = getEntityIdentifier(access);

  if (!identifier) {
    throw new Error("Missing quest access identifier");
  }

  const updated = await strapiUpdate<QuestAccessData>("/quest-accesses", identifier, {
    lastOpenedAt: now().toISOString(),
    status: "active",
  });

  return updated.data ?? access;
}

async function touchQuestProgressActivity(progress: StrapiEntity<QuestProgressData>) {
  const identifier = getEntityIdentifier(progress);

  if (!identifier) {
    throw new Error("Missing quest progress identifier");
  }

  const updated = await strapiUpdate<QuestProgressData>("/quest-progresses", identifier, {
    lastActiveAt: now().toISOString(),
  });

  return updated.data ?? progress;
}

async function ensureQuestAccessProgress(
  access: StrapiEntity<QuestAccessData>,
  purchase: StrapiEntity<QuestPurchaseData>
) {
  const accessData = unwrapStrapiEntity<QuestAccessData>(access);
  const progress = getRelationEntity<QuestProgressData>(accessData?.progress);

  if (progress) {
    return access;
  }

  const purchaseData = unwrapStrapiEntity<QuestPurchaseData>(purchase);
  const questEntity = getRelationEntity<QuestAccessQuestData>(purchaseData?.quest);
  const questId = getEntityIdentifier(questEntity);
  const accessId = getEntityIdentifier(access);

  if (!questId || !accessId) {
    throw new Error("Missing identifiers to create quest progress");
  }

  const firstStep = await fetchQuestStepByQuestAndOrder(questId, 1);

  if (!firstStep) {
    throw new Error("Quest has no first step");
  }

  await createQuestProgress(accessId, firstStep);
  return fetchQuestAccessById(accessId);
}

async function rebindQuestAccessToSession(
  access: StrapiEntity<QuestAccessData>,
  session: StrapiEntity<PlayerSessionData>
) {
  const accessData = unwrapStrapiEntity<QuestAccessData>(access);
  const identifier = getEntityIdentifier(access);
  const sessionId = getEntityIdentifier(session);

  if (!accessData || !identifier || !sessionId) {
    throw new Error("Missing identifiers to rebind quest access");
  }

  const updated = await strapiUpdate<QuestAccessData>("/quest-accesses", identifier, {
    currentPlayerSession: sessionId,
    status: "active",
    lastOpenedAt: now().toISOString(),
    lastRecoveredAt: now().toISOString(),
    recoveryCount: Number(accessData.recoveryCount ?? 0) + 1,
  });

  return updated.data ?? access;
}

export function serializeOwnedQuestSummary(
  access: StrapiEntity<QuestAccessData>,
  recovered = false
): OwnedQuestSummary {
  const accessData = unwrapStrapiEntity<QuestAccessData>(access);
  const quest = unwrapRelationEntity<QuestAccessQuestData>(accessData?.quest);
  const progress = unwrapRelationEntity<QuestProgressData>(accessData?.progress);
  const accessId = getEntityIdentifier(access);

  if (!accessData || !quest || !progress || !accessId) {
    throw new Error("Quest access is missing quest or progress information");
  }

  const restartCurrentStep =
    progress.status === "active" &&
    hasStepGoneStale(progress.lastActiveAt, progress.lastCheckpointAt);
  const completedStepOrders = normalizeCompletedSteps(progress.completedStepOrders);

  return {
    questAccessId: accessId,
    questTitle: quest.title,
    questSlug: quest.slug,
    questDescription: quest.description ?? null,
    questCity: quest.city ?? null,
    questDifficulty: quest.difficulty ?? null,
    questDuration: quest.duration ?? null,
    coverImage: quest.coverImage ?? null,
    progressStatus: progress.status,
    currentStepDocumentId: progress.currentStepDocumentId,
    currentStepOrder: Number(progress.currentStepOrder),
    completedStepOrders,
    completedStepsCount: completedStepOrders.length,
    version: Number(progress.version),
    recovered,
    restartCurrentStep,
    warningMessage: restartCurrentStep ? buildRestartWarning() : undefined,
    firstRedeemedAt: accessData.firstRedeemedAt,
    lastOpenedAt: accessData.lastOpenedAt ?? null,
    lastCheckpointAt: progress.lastCheckpointAt,
    playHref: `/play/${accessId}`,
    stepHref: `/play/${accessId}/step`,
  };
}

export async function redeemQuestCodeForSession(
  code: string,
  cookieStore: CookieStore
): Promise<RedeemQuestResult> {
  await maybeRunLifecycleMaintenance();

  const purchase = await fetchQuestPurchaseByCode(code);

  if (!purchase) {
    throw new Error("Invalid redemption code");
  }

  const purchaseData = unwrapStrapiEntity<QuestPurchaseData>(purchase);

  if (!purchaseData || purchaseData.purchaseStatus === "pending") {
    throw new Error("This quest purchase is not ready yet.");
  }

  const session = await ensurePlayerSession(cookieStore);
  const purchaseId = getEntityIdentifier(purchase);

  if (!purchaseId) {
    throw new Error("Purchase is missing an identifier");
  }

  let access =
    getRelationEntity<QuestAccessData>(purchaseData.questAccess) ??
    (await fetchQuestAccessByQuestPurchaseId(purchaseId));
  let recovered = false;

  if (!access) {
    access = await createQuestAccessForPurchase(purchase, session.session);
  } else {
    access = (await ensureQuestAccessProgress(access, purchase)) ?? access;
    const accessData = unwrapStrapiEntity<QuestAccessData>(access);
    const currentSessionEntity = getRelationEntity<PlayerSessionData>(
      accessData?.currentPlayerSession
    );
    const currentSessionId = getEntityIdentifier(currentSessionEntity);
    const activeSessionId = getEntityIdentifier(session.session);

    if (currentSessionId !== activeSessionId) {
      access = await rebindQuestAccessToSession(access, session.session);
      recovered = true;
    } else {
      access = await touchQuestAccess(access);
    }
  }

  if (!access) {
    throw new Error("Quest access could not be created or recovered.");
  }

  return {
    recovered,
    summary: serializeOwnedQuestSummary(access, recovered),
    session,
  };
}

export async function listOwnedQuestSummariesForSession(
  session: StrapiEntity<PlayerSessionData>
) {
  await maybeRunLifecycleMaintenance();

  const sessionId = getEntityIdentifier(session);

  if (!sessionId) {
    return [];
  }

  const accesses = await fetchQuestAccessesBySession(sessionId);
  return accesses
    .map((access) => serializeOwnedQuestSummary(access))
    .sort((a, b) => {
      const left = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
      const right = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
      return right - left;
    });
}

export async function getOwnedQuestSummaryForSession(
  session: StrapiEntity<PlayerSessionData>,
  questAccessId: string
) {
  await maybeRunLifecycleMaintenance();

  const access = await fetchQuestAccessById(questAccessId);

  if (!access) {
    return null;
  }

  const accessData = unwrapStrapiEntity<QuestAccessData>(access);
  const currentSession = getRelationEntity<PlayerSessionData>(
    accessData?.currentPlayerSession
  );

  if (
    accessData?.status !== "active" ||
    getEntityIdentifier(currentSession) !== getEntityIdentifier(session)
  ) {
    return null;
  }

  const touched = await touchQuestAccess(access);
  const touchedData = unwrapStrapiEntity<QuestAccessData>(touched);
  const progress = getRelationEntity<QuestProgressData>(touchedData?.progress);

  if (progress) {
    await touchQuestProgressActivity(progress);
  }

  const touchedId = getEntityIdentifier(touched);
  const refreshed =
    touchedId ? await fetchQuestAccessById(touchedId) : touched;

  return serializeOwnedQuestSummary(refreshed ?? touched);
}

export async function getOwnedQuestSummaryForSessionByQuestSlug(
  session: StrapiEntity<PlayerSessionData>,
  questSlug: string
) {
  await maybeRunLifecycleMaintenance();

  const sessionId = getEntityIdentifier(session);

  if (!sessionId) {
    return null;
  }

  const access = await fetchQuestAccessForSessionByQuestSlug(sessionId, questSlug);

  if (!access) {
    return null;
  }

  const accessData = unwrapStrapiEntity<QuestAccessData>(access);
  const progress = getRelationEntity<QuestProgressData>(accessData?.progress);

  if (progress) {
    await touchQuestProgressActivity(progress);
  }

  const accessId = getEntityIdentifier(access);
  const refreshed = accessId ? await fetchQuestAccessById(accessId) : access;
  return serializeOwnedQuestSummary(refreshed ?? access);
}

export async function forgetQuestAccessForSession(
  session: StrapiEntity<PlayerSessionData>,
  questAccessId: string
) {
  const access = await fetchQuestAccessById(questAccessId);

  if (!access) {
    throw new Error("Quest access not found");
  }

  const accessData = unwrapStrapiEntity<QuestAccessData>(access);
  const currentSession = getRelationEntity<PlayerSessionData>(
    accessData?.currentPlayerSession
  );

  if (getEntityIdentifier(currentSession) !== getEntityIdentifier(session)) {
    throw new Error("Quest access does not belong to the current session");
  }

  const identifier = getEntityIdentifier(access);

  if (!identifier) {
    throw new Error("Missing quest access identifier");
  }

  await strapiUpdate<QuestAccessData>("/quest-accesses", identifier, {
    status: "revoked",
    lastOpenedAt: now().toISOString(),
  });
}

function validateSubmission(
  step: StrapiEntity<QuestStepData>,
  submission: PuzzleSubmission
) {
  const stepData = unwrapStrapiEntity<QuestStepData>(step);

  if (!stepData) {
    return false;
  }

  if (stepData.puzzleType !== submission.type) {
    throw new Error(
      `Submission type does not match current puzzle type: ${stepData.puzzleType}`
    );
  }

  const publicPuzzle = parsePublicPuzzleData(
    stepData.puzzleType,
    stepData.puzzleDataPublic ?? {}
  );
  const privatePuzzle = parsePrivatePuzzleData(
    stepData.puzzleType,
    stepData.puzzleDataPrivate ?? {}
  );

  switch (submission.type) {
    case "text":
      if (privatePuzzle.type !== "text") {
        return false;
      }

      return validateTextSubmission(privatePuzzle.data, submission);
    case "hangman":
      if (publicPuzzle.type !== "hangman" || privatePuzzle.type !== "hangman") {
        return false;
      }

      return validateHangmanSubmission(
        publicPuzzle.data,
        privatePuzzle.data,
        submission
      );
    case "sudoku":
      if (privatePuzzle.type !== "sudoku") {
        return false;
      }

      return validateSudokuSubmission(privatePuzzle.data, submission);
  }
}

export async function advanceOwnedQuestProgress({
  coords,
  questAccessId,
  submission,
  stepDocumentId,
  version,
}: {
  coords: { lat: number; lng: number; accuracy: number };
  questAccessId: string;
  submission: unknown;
  stepDocumentId: string;
  version: number;
}) {
  await maybeRunLifecycleMaintenance();

  const access = await fetchQuestAccessById(questAccessId);

  if (!access) {
    throw new Error("Quest access not found");
  }

  const accessData = unwrapStrapiEntity<QuestAccessData>(access);
  const progressEntity = getRelationEntity<QuestProgressData>(accessData?.progress);
  const progressData = unwrapRelationEntity<QuestProgressData>(accessData?.progress);
  const questEntity = getRelationEntity<QuestAccessQuestData>(accessData?.quest);
  const questId = getEntityIdentifier(questEntity);

  if (!accessData || !progressEntity || !progressData || !questId) {
    throw new Error("Quest access is missing progress information");
  }

  const progressId = getEntityIdentifier(progressEntity);

  if (!progressId) {
    throw new Error("Quest progress is missing an identifier");
  }

  const progressLock = await acquireQuestProgressLock(progressId);

  try {
    const lockedAccess = await fetchQuestAccessById(questAccessId);
    const lockedAccessData = unwrapStrapiEntity<QuestAccessData>(lockedAccess);
    const lockedProgressEntity = getRelationEntity<QuestProgressData>(lockedAccessData?.progress);
    const lockedProgressData = unwrapRelationEntity<QuestProgressData>(lockedAccessData?.progress);
    const lockedQuestEntity = getRelationEntity<QuestAccessQuestData>(lockedAccessData?.quest);
    const lockedQuestId = getEntityIdentifier(lockedQuestEntity);

    if (!lockedAccessData || !lockedProgressEntity || !lockedProgressData || !lockedQuestId) {
      throw new Error("Quest access is missing progress information");
    }

    if (lockedProgressData.version !== version) {
      throw new Error("Quest progress is stale. Please reload and try again.");
    }

    if (lockedProgressData.currentStepDocumentId !== stepDocumentId) {
      throw new Error("This step is not the current step for the quest.");
    }

    const step = await fetchQuestStepByDocumentId(stepDocumentId, true);

    if (!step) {
      throw new Error("Quest step not found");
    }

    const stepData = unwrapStrapiEntity<QuestStepData>(step);

    if (!stepData) {
      throw new Error("Quest step is missing data");
    }

    const parsedSubmission = parsePuzzleSubmission(
      stepData.puzzleType,
      submission
    );

    const { haversineDistanceMeters } = await import("@/lib/geo/distanceServer");
    const distance = haversineDistanceMeters(
      { lat: coords.lat, lng: coords.lng },
      {
        lat: Number(stepData.latitude),
        lng: Number(stepData.longitude),
      }
    );

    const accuracy = Number(coords.accuracy ?? 0);
    const buffer = Math.max(accuracy, 10);
    const radiusMeters = Number(stepData.radiusMeters);
    const effectiveRadius = radiusMeters + buffer;
    const locationOk = distance <= effectiveRadius;
    const answerOk = validateSubmission(step, parsedSubmission);
    const unlocked = locationOk && answerOk;
    const activityTime = now().toISOString();

    if (!unlocked) {
      await strapiUpdate<QuestProgressData>("/quest-progresses", progressId, {
        lastActiveAt: activityTime,
      });

      return {
        ok: true,
        unlocked: false,
        questCompleted: false,
        nextStepDocumentId: null,
        nextStepOrder: null,
        version: lockedProgressData.version,
        checks: {
          locationOk,
          answerOk,
          distanceMeters: Math.round(distance),
          radiusMeters,
          bufferMeters: Math.round(buffer),
          effectiveRadiusMeters: Math.round(effectiveRadius),
          accuracyMeters: Math.round(accuracy),
        },
      } satisfies SubmissionAdvanceResult;
    }

    const completedStepOrders = Array.from(
      new Set([
        ...normalizeCompletedSteps(lockedProgressData.completedStepOrders),
        Number(stepData.order),
      ])
    ).sort((left, right) => left - right);
    const nextStep = await fetchQuestStepByQuestAndOrder(
      lockedQuestId,
      Number(stepData.order) + 1,
      false
    );
    const checkpointTime = now().toISOString();
    const nextStepId = getEntityIdentifier(nextStep);
    const nextStepData = unwrapStrapiEntity<QuestStepData>(nextStep);
    const nextVersion = Number(lockedProgressData.version) + 1;

    await strapiUpdate<QuestProgressData>("/quest-progresses", progressId, {
      currentStepDocumentId: nextStepId ?? lockedProgressData.currentStepDocumentId,
      currentStepOrder: nextStepData?.order ?? lockedProgressData.currentStepOrder,
      completedStepOrders,
      status: nextStep ? "active" : "completed",
      currentStepStartedAt: nextStep
        ? checkpointTime
        : lockedProgressData.currentStepStartedAt ?? checkpointTime,
      lastActiveAt: checkpointTime,
      lastCheckpointAt: checkpointTime,
      version: nextVersion,
    });

    const accessId = getEntityIdentifier(lockedAccess);

    if (accessId) {
      await strapiUpdate<QuestAccessData>("/quest-accesses", accessId, {
        lastOpenedAt: checkpointTime,
      });
    }

    return {
      ok: true,
      unlocked: true,
      questCompleted: !nextStep,
      nextStepDocumentId: nextStepId ?? null,
      nextStepOrder: nextStepData ? Number(nextStepData.order) : null,
      version: nextVersion,
      checks: {
        locationOk,
        answerOk,
        distanceMeters: Math.round(distance),
        radiusMeters,
        bufferMeters: Math.round(buffer),
        effectiveRadiusMeters: Math.round(effectiveRadius),
        accuracyMeters: Math.round(accuracy),
      },
    } satisfies SubmissionAdvanceResult;
  } finally {
    await releaseQuestProgressLock(progressLock);
  }
}

export async function getCurrentStepForOwnedQuest(
  session: StrapiEntity<PlayerSessionData>,
  questAccessId: string
) {
  const summary = await getOwnedQuestSummaryForSession(session, questAccessId);

  if (!summary) {
    return null;
  }

  const step = await fetchQuestStepByDocumentId(summary.currentStepDocumentId, true);

  if (!step) {
    return null;
  }

  const stepData = unwrapStrapiEntity<QuestStepData>(step);

  if (!stepData) {
    return null;
  }

  const stepDocumentId = getEntityIdentifier(step);

  if (!stepDocumentId) {
    return null;
  }

  return {
    summary,
    step: {
      documentId: stepDocumentId,
      order: Number(stepData.order),
      title: stepData.title ?? "",
      flavorText: stepData.flavorText ?? "",
      successText: stepData.successText ?? "",
      updatedAt: stepData.updatedAt ?? "",
      latitude: Number(stepData.latitude),
      longitude: Number(stepData.longitude),
      radiusMeters: Number(stepData.radiusMeters),
      puzzleType: stepData.puzzleType,
      puzzleDataPublic: parsePublicPuzzleData(
        stepData.puzzleType,
        stepData.puzzleDataPublic ?? {}
      ).data,
    },
  };
}

export async function previewHangmanForOwnedQuest(
  session: StrapiEntity<PlayerSessionData>,
  questAccessId: string,
  stepDocumentId: string,
  guessedLetters: string[]
): Promise<HangmanPreview> {
  const summary = await getOwnedQuestSummaryForSession(session, questAccessId);

  if (!summary) {
    throw new Error("Quest access not found");
  }

  if (summary.currentStepDocumentId !== stepDocumentId) {
    throw new Error("This step is not the current step for the quest.");
  }

  const step = await fetchQuestStepByDocumentId(stepDocumentId, true);

  if (!step) {
    throw new Error("Quest step not found");
  }

  const stepData = unwrapStrapiEntity<QuestStepData>(step);

  if (!stepData) {
    throw new Error("Quest step is missing data");
  }

  if (stepData.puzzleType !== "hangman") {
    throw new Error(
      `Unsupported puzzleType for validation yet: ${stepData.puzzleType}`
    );
  }

  const publicPuzzle = parsePublicPuzzleData(
    stepData.puzzleType,
    stepData.puzzleDataPublic ?? {}
  );
  const privatePuzzle = parsePrivatePuzzleData(
    stepData.puzzleType,
    stepData.puzzleDataPrivate ?? {}
  );

  if (publicPuzzle.type !== "hangman" || privatePuzzle.type !== "hangman") {
    throw new Error("Hangman puzzle data is invalid.");
  }

  return buildHangmanPreview(
    privatePuzzle.data.solution,
    guessedLetters,
    publicPuzzle.data.maxWrongGuesses
  );
}

export async function evaluateSudokuForOwnedQuest(
  session: StrapiEntity<PlayerSessionData>,
  questAccessId: string,
  stepDocumentId: string,
  grid: number[][]
): Promise<SudokuEvaluation> {
  const summary = await getOwnedQuestSummaryForSession(session, questAccessId);

  if (!summary) {
    throw new Error("Quest access not found");
  }

  if (summary.currentStepDocumentId !== stepDocumentId) {
    throw new Error("This step is not the current step for the quest.");
  }

  const step = await fetchQuestStepByDocumentId(stepDocumentId, true);

  if (!step) {
    throw new Error("Quest step not found");
  }

  const stepData = unwrapStrapiEntity<QuestStepData>(step);

  if (!stepData) {
    throw new Error("Quest step is missing data");
  }

  if (stepData.puzzleType !== "sudoku") {
    throw new Error(
      `Unsupported puzzleType for validation yet: ${stepData.puzzleType}`
    );
  }

  const privatePuzzle = parsePrivatePuzzleData(
    stepData.puzzleType,
    stepData.puzzleDataPrivate ?? {}
  );

  if (privatePuzzle.type !== "sudoku") {
    throw new Error("Sudoku puzzle data is invalid.");
  }

  return evaluateSudokuGrid(privatePuzzle.data.solutionGrid, grid);
}
