// Lightweight in-memory rate limiter (per server instance). Good enough as a
// first line against bursts/bots. For multi-instance hardening, back this with
// Redis/Upstash. Not a security boundary on its own — the DB constraints and
// RPC checks remain authoritative.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Returns true if the action is allowed, false if the limit is exceeded.
 * @param key unique key (e.g. `vote:<userId>` or `register:<ipHash>`)
 * @param limit max actions per window
 * @param windowMs window length in ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistic cleanup to bound memory.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
    }
    return true;
  }

  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}
