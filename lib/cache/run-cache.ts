import type { EnrichedOrgReport } from "@/lib/run/report-schema";

type CacheEntry = {
  runId: string;
  slug?: string;
  chatId?: string;
  report: EnrichedOrgReport | null;
  updatedAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __runCacheStore: Map<string, CacheEntry> | undefined;
}

const CACHE_TTL_MS = Number(process.env.RUN_CACHE_TTL_MS ?? 1000 * 60 * 5);

const cache = (globalThis.__runCacheStore =
  globalThis.__runCacheStore ?? new Map<string, CacheEntry>());

function isExpired(entry: CacheEntry) {
  if (CACHE_TTL_MS <= 0) return false;
  return Date.now() - entry.updatedAt > CACHE_TTL_MS;
}

export function setRunCache(entry: CacheEntry) {
  const normalized = { ...entry, updatedAt: Date.now() };
  cache.set(entry.runId, normalized);
  if (entry.slug) {
    cache.set(entry.slug, normalized);
  }
}

export function getRunCache(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    cache.delete(key);
    if (entry.slug) {
      cache.delete(entry.slug);
    }
    return null;
  }
  return entry;
}
