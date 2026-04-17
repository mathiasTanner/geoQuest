import { createHash } from "crypto";
import { getCmsUrl, getStrapiApiToken } from "@/lib/purchases/questPurchaseWorkflow";

type StrapiEntity<T> = {
  id?: number;
  documentId?: string;
  attributes?: T;
} & T;

type StrapiListResponse<T> = {
  data?: Array<StrapiEntity<T>>;
  meta?: {
    pagination?: {
      total?: number;
    };
  };
};

type RateLimitHitData = {
  scope: string;
  keyHash: string;
  expiresAt: string;
};

function hashRateLimitKey(scope: string, key: string) {
  return createHash("sha256").update(`${scope}:${key}`).digest("hex");
}

function getEntityIdentifier(entity: { documentId?: string; id?: number } | null | undefined) {
  if (!entity) {
    return null;
  }

  return entity.documentId ?? (typeof entity.id === "number" ? String(entity.id) : null);
}

async function strapiRateLimitRequest(path: string, init?: RequestInit) {
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

async function createRateLimitHit(scope: string, keyHash: string, expiresAt: string) {
  const response = await strapiRateLimitRequest("/rate-limit-hits", {
    method: "POST",
    body: JSON.stringify({
      data: {
        scope,
        keyHash,
        expiresAt,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to persist rate limit hit (${response.status})\n${body}`);
  }
}

async function countActiveRateLimitHits(scope: string, keyHash: string, nowIso: string) {
  const response = await strapiRateLimitRequest(
    `/rate-limit-hits?filters[scope][$eq]=${encodeURIComponent(
      scope
    )}&filters[keyHash][$eq]=${encodeURIComponent(
      keyHash
    )}&filters[expiresAt][$gt]=${encodeURIComponent(
      nowIso
    )}&pagination[pageSize]=1&pagination[withCount]=true`
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to count rate limit hits (${response.status})\n${body}`);
  }

  const json = (await response.json()) as StrapiListResponse<RateLimitHitData>;
  return json.meta?.pagination?.total ?? json.data?.length ?? 0;
}

async function pruneExpiredRateLimitHits(scope: string, keyHash: string, nowIso: string) {
  const response = await strapiRateLimitRequest(
    `/rate-limit-hits?filters[scope][$eq]=${encodeURIComponent(
      scope
    )}&filters[keyHash][$eq]=${encodeURIComponent(
      keyHash
    )}&filters[expiresAt][$lte]=${encodeURIComponent(
      nowIso
    )}&pagination[pageSize]=25`
  );

  if (!response.ok) {
    return;
  }

  const json = (await response.json()) as StrapiListResponse<RateLimitHitData>;
  const identifiers = (json.data ?? [])
    .map((entity) => getEntityIdentifier(entity))
    .filter((identifier): identifier is string => Boolean(identifier));

  await Promise.all(
    identifiers.map(async (identifier) => {
      await strapiRateLimitRequest(`/rate-limit-hits/${identifier}`, {
        method: "DELETE",
      }).catch(() => {
        // Best-effort retention cleanup for expired buckets.
      });
    })
  );
}

export async function takeRateLimitHit(key: string, maxHits: number, windowMs: number) {
  const separatorIndex = key.indexOf(":");
  const scope = separatorIndex >= 0 ? key.slice(0, separatorIndex) : "default";
  const rawKey = separatorIndex >= 0 ? key.slice(separatorIndex + 1) : key;
  const keyHash = hashRateLimitKey(scope, rawKey);
  const currentTime = Date.now();
  const nowIso = new Date(currentTime).toISOString();
  const resetAt = currentTime + windowMs;

  await pruneExpiredRateLimitHits(scope, keyHash, nowIso);
  await createRateLimitHit(scope, keyHash, new Date(resetAt).toISOString());
  const count = await countActiveRateLimitHits(scope, keyHash, nowIso);

  return {
    allowed: count <= maxHits,
    remaining: Math.max(maxHits - count, 0),
    resetAt,
  };
}
