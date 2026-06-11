/**
 * A5: In-memory rate limiter.
 *
 * NOTE: This is a best-effort, per-instance rate limiter. On serverless
 * platforms (Vercel) each function instance maintains its own state, so the
 * effective limit is multiplied by the number of concurrent instances. This is
 * acceptable for light abuse deterrence; a Redis-backed limiter would be
 * needed for strict enforcement across all instances.
 */

// module-level singleton: key → sorted array of request timestamps (ms)
const store = new Map<string, number[]>();

/**
 * Check whether a request identified by `key` is within the allowed rate.
 *
 * @param key       Unique identifier for the rate-limit bucket (e.g. "otp:1.2.3.4")
 * @param limit     Maximum number of requests allowed in the window
 * @param windowMs  Rolling window size in milliseconds
 * @returns `{ allowed: boolean; retryAfterSeconds: number }`
 *          When not allowed, retryAfterSeconds is the seconds until the oldest
 *          request in the window expires and a slot opens up.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Prune timestamps outside the current window on access
  const timestamps = (store.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    // Oldest timestamp in window determines when the next slot opens
    const oldestInWindow = timestamps[0]!;
    const retryAfterMs = oldestInWindow + windowMs - now;
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    store.set(key, timestamps);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return { allowed: true, retryAfterSeconds: 0 };
}
