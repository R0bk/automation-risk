const DEFAULT_LIMIT = Number(process.env.RUN_RATE_LIMIT ?? 10);
const DEFAULT_WINDOW_MS = Number(process.env.RUN_RATE_LIMIT_WINDOW_MS ?? 1000 * 60 * 60);

declare global {
  // eslint-disable-next-line no-var
  var __runRateLimiter: Map<string, number[]> | undefined;
}

const rateLimiterStore = (globalThis.__runRateLimiter =
  globalThis.__runRateLimiter ?? new Map<string, number[]>());

export function enforceRunRateLimit(ip: string) {
  if (!ip) {
    return { allowed: true, remaining: null, retryAfterMs: 0 } as const;
  }

  if (DEFAULT_LIMIT <= 0) {
    return { allowed: true, remaining: null, retryAfterMs: 0 } as const;
  }

  const windowMs = Number.isFinite(DEFAULT_WINDOW_MS)
    ? DEFAULT_WINDOW_MS
    : 1000 * 60 * 60;
  const now = Date.now();
  const earliest = now - windowMs;

  const history = rateLimiterStore.get(ip) ?? [];
  const recent = history.filter((timestamp) => timestamp > earliest);

  if (recent.length >= DEFAULT_LIMIT) {
    const retryAfterMs = windowMs - (now - recent[0]);
    return {
      allowed: false as const,
      remaining: 0,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  recent.push(now);
  rateLimiterStore.set(ip, recent);

  return {
    allowed: true as const,
    remaining: DEFAULT_LIMIT - recent.length,
    retryAfterMs: 0,
  };
}
