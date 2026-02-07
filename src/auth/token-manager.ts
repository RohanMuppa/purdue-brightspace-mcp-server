import type { TokenData } from "../types/index.js";
import { SessionStore } from "./session-store.js";
import { log } from "../utils/logger.js";

/**
 * Token refresh buffer - tokens within this time of expiry are considered invalid.
 * This prevents using tokens that might expire during a request.
 */
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * TokenManager manages token lifecycle with in-memory caching and disk persistence.
 * Handles expiry detection with a configurable refresh buffer.
 */
export class TokenManager {
  private cachedToken: TokenData | null = null;
  private readonly sessionStore: SessionStore;

  constructor(sessionDir?: string) {
    this.sessionStore = new SessionStore(sessionDir);
  }

  /**
   * Get the current token if valid, otherwise null.
   * Checks memory cache first, then loads from disk if needed.
   * Returns null if token is expired or within refresh buffer.
   */
  async getToken(): Promise<TokenData | null> {
    // Check memory cache first
    if (this.cachedToken && this.isValid(this.cachedToken)) {
      log("DEBUG", "Returning cached token");
      return this.cachedToken;
    }

    // Try loading from disk
    const storedToken = await this.sessionStore.load();
    if (storedToken && this.isValid(storedToken)) {
      log("DEBUG", "Loaded valid token from session store");
      this.cachedToken = storedToken;
      return storedToken;
    }

    log("DEBUG", "No valid token available");
    return null;
  }

  /**
   * Set a new token, caching in memory and persisting to disk.
   */
  async setToken(token: TokenData): Promise<void> {
    this.cachedToken = token;
    await this.sessionStore.save(token);
    log("DEBUG", "Token cached and persisted");
  }

  /**
   * Clear the token from memory and disk.
   */
  async clearToken(): Promise<void> {
    this.cachedToken = null;
    await this.sessionStore.clear();
    log("DEBUG", "Token cleared from memory and disk");
  }

  /**
   * Check if a token is valid (not expired and outside refresh buffer).
   * A token is valid if it expires more than REFRESH_BUFFER_MS from now.
   */
  isValid(token: TokenData): boolean {
    const now = Date.now();
    const timeUntilExpiry = token.expiresAt - now;

    // Token must expire more than REFRESH_BUFFER_MS in the future
    const valid = timeUntilExpiry > REFRESH_BUFFER_MS;

    if (!valid) {
      log(
        "DEBUG",
        `Token invalid: expires in ${Math.round(timeUntilExpiry / 1000)}s (buffer: ${REFRESH_BUFFER_MS / 1000}s)`
      );
    }

    return valid;
  }

  /**
   * Check if a token refresh is needed.
   * Returns true if no valid token is available.
   */
  async needsRefresh(): Promise<boolean> {
    const token = await this.getToken();
    return token === null;
  }
}
