/**
 * Purdue Brightspace MCP Server
 * Copyright (c) 2025 Rohan Muppa. All rights reserved.
 * Licensed under AGPL-3.0 — see LICENSE file for details.
 */

import type { ApiVersions } from "./types.js";
import { NetworkError } from "./errors.js";
import { log } from "../utils/logger.js";

interface D2LVersionEntry {
  ProductCode: string;
  LatestVersion: string;
}

/**
 * Auto-discover D2L API versions from the public /d2l/api/versions/ endpoint.
 *
 * @param baseUrl - Base URL of the D2L instance (e.g., "https://purdue.brightspace.com")
 * @param timeoutMs - Request timeout in milliseconds (default: 15000)
 * @returns Object with discovered LP and LE versions
 * @throws NetworkError if fetch fails or versions cannot be parsed
 */
export async function discoverVersions(
  baseUrl: string,
  timeoutMs: number = 15000
): Promise<ApiVersions> {
  const url = `${baseUrl}/d2l/api/versions/`;

  try {
    log("DEBUG", `Discovering API versions from ${url}`);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        // Browser-like User-Agent for version discovery
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new NetworkError(
        `Version discovery failed with status ${response.status}`,
      );
    }

    const versions: D2LVersionEntry[] = await response.json();

    // Find LP (Learning Platform) and LE (Learning Environment) versions
    const lpEntry = versions.find(v => v.ProductCode === "lp");
    const leEntry = versions.find(v => v.ProductCode === "le");

    if (!lpEntry) {
      throw new NetworkError(
        "LP (Learning Platform) version not found in /d2l/api/versions/ response",
      );
    }

    if (!leEntry) {
      throw new NetworkError(
        "LE (Learning Environment) version not found in /d2l/api/versions/ response",
      );
    }

    const result: ApiVersions = {
      lp: lpEntry.LatestVersion,
      le: leEntry.LatestVersion,
    };

    log("INFO", `Discovered API versions: LP ${result.lp}, LE ${result.le}`);

    return result;
  } catch (error) {
    if (error instanceof NetworkError) {
      throw error;
    }

    // Wrap other errors (timeout, network failures, JSON parse errors)
    const message = error instanceof Error ? error.message : String(error);
    throw new NetworkError(
      `Failed to discover API versions: ${message}`,
      error instanceof Error ? error : undefined,
    );
  }
}
