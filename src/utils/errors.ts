/**
 * Purdue Brightspace MCP Server
 * Copyright (c) 2025 Rohan Muppa. All rights reserved.
 * Licensed under AGPL-3.0 — see LICENSE file for details.
 */

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class TokenExpiredError extends AuthError {
  constructor(public readonly expiredAt: number) {
    super(`Token expired at ${new Date(expiredAt).toISOString()}`);
    this.name = "TokenExpiredError";
  }
}

export class BrowserAuthError extends AuthError {
  constructor(
    message: string,
    public readonly step: string,
    cause?: Error,
  ) {
    super(`Browser auth failed at step "${step}": ${message}`, cause);
    this.name = "BrowserAuthError";
  }
}

export class SessionStoreError extends AuthError {
  constructor(message: string, cause?: Error) {
    super(`Session store error: ${message}`, cause);
    this.name = "SessionStoreError";
  }
}
