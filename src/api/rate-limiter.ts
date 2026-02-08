// Token bucket rate limiter - allows bursts up to capacity
// Conservative defaults: capacity 10, refill 3/sec

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity; // Start with full bucket
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;
    const elapsedSeconds = elapsedMs / 1000;

    // Add tokens based on elapsed time
    const tokensToAdd = elapsedSeconds * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async consume(count: number = 1): Promise<void> {
    this.refill();

    if (this.tokens >= count) {
      // Enough tokens available - consume immediately
      this.tokens -= count;
      return;
    }

    // Not enough tokens - calculate wait time
    const tokensNeeded = count - this.tokens;
    const waitTimeMs = (tokensNeeded / this.refillRate) * 1000;

    // Wait for tokens to refill
    await new Promise((resolve) => setTimeout(resolve, waitTimeMs));

    // Refill and consume
    this.refill();
    this.tokens -= count;
  }

  tryConsume(count: number = 1): boolean {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }

  get availableTokens(): number {
    this.refill();
    return this.tokens;
  }
}
