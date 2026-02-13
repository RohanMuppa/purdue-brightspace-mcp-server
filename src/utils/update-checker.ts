/**
 * Purdue Brightspace MCP Server
 * Copyright (c) 2025 Rohan Muppa. All rights reserved.
 * Licensed under AGPL-3.0 — see LICENSE file for details.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./logger.js";

const execFileAsync = promisify(execFile);

// Derive project root from import.meta.url (same pattern as check-for-updates.ts)
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Module-level state for the update notice (consume-once pattern)
let pendingNotice: string | null = null;

/**
 * Initialize background update check.
 * Fires and forgets — does NOT block (no await at call site).
 * Silently handles all errors (network, git, etc.).
 */
export function initUpdateChecker(): void {
  // Fire and forget — run async work in background
  (async () => {
    try {
      // Step 1: Fetch latest from origin/main
      await execFileAsync("git", ["fetch", "origin", "main"], {
        cwd: projectRoot,
        timeout: 10000, // 10s timeout for network fetch
      });

      // Step 2: Check how many commits we're behind
      const { stdout } = await execFileAsync(
        "git",
        ["rev-list", "--count", "HEAD..origin/main"],
        {
          cwd: projectRoot,
          timeout: 5000,
        }
      );

      const count = parseInt(stdout.trim(), 10);

      if (count > 0) {
        const plural = count === 1 ? "" : "s";
        pendingNotice = `\n\n---\nUpdate available: ${count} new commit${plural}. Ask me to 'check for updates' to see details and install, or run \`purdue-brightspace-update\` in your terminal.`;
      } else {
        pendingNotice = null;
      }
    } catch (error) {
      // Silent failure — no network, not a git repo, timeout, etc.
      // Log at DEBUG level for troubleshooting but don't surface to user
      log("DEBUG", "Background update check failed (silent skip)", error);
      pendingNotice = null;
    }
  })();
}

/**
 * Get the pending update notice (if any) and consume it.
 * Returns the notice once, then sets it to null (consume-once pattern).
 * This ensures the notice only appears on the first tool call per session.
 */
export function getUpdateNotice(): string | null {
  const notice = pendingNotice;
  pendingNotice = null; // Consume immediately
  return notice;
}
