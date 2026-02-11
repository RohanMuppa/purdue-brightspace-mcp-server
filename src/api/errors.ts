/**
 * Purdue Brightspace MCP Server
 * Copyright (c) 2025 Rohan Muppa. All rights reserved.
 * Licensed under AGPL-3.0 — see LICENSE file for details.
 */

import { AuthError } from "../utils/errors.js";

// Base class for all HTTP API errors
export class ApiError extends AuthError {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    message: string,
    public readonly responseBody?: string,
    cause?: Error,
  ) {
    super(`API error (${status}) at ${endpoint}: ${message}`, cause);
    this.name = "ApiError";
  }
}

// Generic HTTP error (non-401/429) - semantic alias for ApiError
export class HttpError extends ApiError {
  constructor(
    status: number,
    endpoint: string,
    message: string,
    responseBody?: string,
    cause?: Error,
  ) {
    super(status, endpoint, message, responseBody, cause);
    this.name = "HttpError";
  }
}

// Rate limit error (429 Too Many Requests)
export class RateLimitError extends ApiError {
  constructor(
    endpoint: string,
    public readonly retryAfter?: number, // seconds
  ) {
    const message = retryAfter
      ? `Rate limited, retry after ${retryAfter}s`
      : "Rate limited";
    super(429, endpoint, message);
    this.name = "RateLimitError";
  }
}

// Network-level error (no HTTP status code)
// For fetch failures, timeouts, DNS errors
export class NetworkError extends AuthError {
  constructor(message: string, cause?: Error) {
    super(`Network error: ${message}`, cause);
    this.name = "NetworkError";
  }
}
