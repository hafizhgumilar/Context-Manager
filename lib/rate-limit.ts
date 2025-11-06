type RateLimitOptions = {
  windowMs: number;
  limit: number;
};

type BucketState = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, BucketState>();

export type RateLimitResult = {
  success: boolean;
  retryAfterSeconds?: number;
};

export function consumeRateLimit(
  bucket: string,
  identifier: string,
  options: RateLimitOptions,
): RateLimitResult {
  const key = `${bucket}:${identifier}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return { success: true };
  }

  if (existing.count >= options.limit) {
    return {
      success: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { success: true };
}
