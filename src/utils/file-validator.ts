/**
 * Purdue Brightspace MCP Server
 * Copyright (c) 2025 Rohan Muppa. All rights reserved.
 * Licensed under AGPL-3.0 — see LICENSE file for details.
 */

import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import sanitizeFilename from "sanitize-filename";

/**
 * Maximum file size for downloads (50 MB).
 * Prevents memory exhaustion from malicious large file requests.
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Allowlist of MIME types safe for download.
 * Prevents execution of potentially malicious file types (executables, scripts).
 */
export const ALLOWED_MIME_TYPES: string[] = [
  // Documents
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/msword", // .doc
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.ms-excel", // .xls
  // Images
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Text
  "text/plain",
  "text/csv",
  "text/html",
  // Data
  "application/json",
  // Archives
  "application/zip",
  "application/x-zip-compressed",
  // Media
  "video/mp4",
  "audio/mpeg",
  "audio/wav",
];

/**
 * Validate and sanitize download path to prevent path traversal attacks.
 *
 * @param baseDir - Base directory where downloads are allowed
 * @param filename - User-provided filename (potentially malicious)
 * @returns Validated absolute path within baseDir
 * @throws Error if path traversal detected
 */
export function validateDownloadPath(
  baseDir: string,
  filename: string
): string {
  // Decode URL-encoded characters
  const decoded = decodeURIComponent(filename);

  // Sanitize filename (removes path separators, null bytes, etc.)
  const sanitized = sanitizeFilename(decoded);

  if (!sanitized || sanitized.length === 0) {
    throw new Error("Invalid filename after sanitization");
  }

  // Resolve full path
  const fullPath = path.resolve(baseDir, sanitized);
  const resolvedBase = path.resolve(baseDir);

  // Verify resolved path is within base directory
  if (
    !fullPath.startsWith(resolvedBase + path.sep) &&
    fullPath !== resolvedBase
  ) {
    throw new Error("Path traversal detected");
  }

  return fullPath;
}

/**
 * Validate file type using magic bytes (not extensions).
 * Prevents MIME type spoofing via filename manipulation.
 *
 * @param buffer - File contents to validate
 * @param allowedTypes - MIME types to allow (defaults to ALLOWED_MIME_TYPES)
 * @returns Detected MIME type and extension
 * @throws Error if file type not allowed
 */
export async function validateFileType(
  buffer: Buffer,
  allowedTypes: string[] = ALLOWED_MIME_TYPES
): Promise<{ mime: string; ext: string }> {
  // Try magic byte detection first
  const detected = await fileTypeFromBuffer(buffer);

  if (detected) {
    if (!allowedTypes.includes(detected.mime)) {
      throw new Error(
        `File type '${detected.mime}' not allowed. Allowed types: ${allowedTypes.join(", ")}`
      );
    }
    return { mime: detected.mime, ext: detected.ext };
  }

  // Fallback for text files that file-type can't detect
  // Check if buffer looks like text (no null bytes, mostly printable chars)
  const isText =
    !buffer.includes(0) && buffer.toString("utf8", 0, 512).match(/^[\x20-\x7E\n\r\t]*$/);

  if (isText) {
    // Allow common text MIME types
    const textTypes = allowedTypes.filter((t) => t.startsWith("text/"));
    if (textTypes.length > 0) {
      // Default to text/plain for undetectable text files
      return { mime: "text/plain", ext: "txt" };
    }
  }

  throw new Error(
    "Could not determine file type or type not allowed"
  );
}

/**
 * Validate content ID is a positive integer.
 * Prevents injection via string-based IDs.
 *
 * @param id - User-provided content ID
 * @returns Validated numeric ID
 * @throws Error if ID is not a positive integer
 */
export function validateContentId(id: unknown): number {
  if (typeof id !== "number") {
    throw new Error("Content ID must be a number");
  }
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Content ID must be a positive integer");
  }
  return id;
}

/**
 * Validate URL starts with expected D2L base URL.
 * Prevents SSRF attacks via user-controlled URLs.
 *
 * @param url - URL to validate
 * @param expectedBaseUrl - Expected D2L base URL (e.g., "https://purdue.brightspace.com")
 * @throws Error if URL doesn't match expected base
 */
export function validateBaseUrl(url: string, expectedBaseUrl: string): void {
  if (!url.startsWith(expectedBaseUrl)) {
    throw new Error(
      `URL must start with ${expectedBaseUrl}, got: ${url.substring(0, 50)}...`
    );
  }
}
