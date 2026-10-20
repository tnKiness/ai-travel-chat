/** Token bucket per key (client IP). Small and in-memory; use Redis for multiple instances. */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; updatedAt: number }>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerMinute: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns 0 if allowed, otherwise the seconds to wait. */
  take(key: string): number {
    const t = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: t };
    bucket.tokens = Math.min(this.capacity, bucket.tokens + ((t - bucket.updatedAt) / 60_000) * this.refillPerMinute);
    bucket.updatedAt = t;
    this.buckets.set(key, bucket);
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return 0;
    }
    return Math.ceil(((1 - bucket.tokens) * 60) / this.refillPerMinute);
  }
}
