import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { ApiError, RateLimitError, NetworkError } from "../api/index.js";
import { log } from "../utils/logger.js";

/**
 * Wrap data as MCP-compatible tool result
 */
export function toolResponse(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Wrap error message as MCP-compatible tool result
 */
export function errorResponse(message: string): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: message,
      },
    ],
    isError: true,
  };
}

/**
 * Sanitize errors for user-friendly messages
 *
 * SECURITY: Never include stack traces, raw API responses, or token values
 */
export function sanitizeError(error: unknown): CallToolResult {
  // Log full error to stderr for debugging (token redaction handled by logger)
  log("ERROR", "Tool error", error);

  // Map to user-friendly messages
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return errorResponse(
        "Resource not found. The course or item may not exist, or you may not have access."
      );
    }
    if (error.status === 401) {
      return errorResponse(
        "Authentication expired. Please run `purdue-brightspace-auth` in your terminal to re-authenticate, then try again."
      );
    }
    if (error.status === 403) {
      return errorResponse(
        "Access denied. You may not have permission to access this resource."
      );
    }
  }

  if (error instanceof RateLimitError) {
    return errorResponse(
      "Rate limited by Brightspace. Please wait a moment and try again."
    );
  }

  if (error instanceof NetworkError) {
    return errorResponse(
      "Could not connect to Brightspace. Check your internet connection."
    );
  }

  if (error instanceof ZodError) {
    const issues = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return errorResponse(`Invalid input: ${issues.join(", ")}`);
  }

  // Default fallback
  return errorResponse("An unexpected error occurred. Please try again.");
}
