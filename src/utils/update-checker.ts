/**
 * Background update checker — non-blocking git fetch on startup.
 * If new commits exist on origin/main, produces a one-time notice
 * that gets appended to the first check_auth response.
 */

import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(__filename), "..", "..");

let notice: string | null = null;

export function initUpdateChecker(): void {
  execFile("git", ["fetch", "origin", "main"], { cwd: projectRoot }, (err) => {
    if (err) return;
    execFile(
      "git",
      ["rev-list", "--count", "HEAD..origin/main"],
      { cwd: projectRoot },
      (err, stdout) => {
        if (err) return;
        const count = parseInt(stdout.trim(), 10);
        if (count > 0) {
          notice =
            `Update available (${count} new commit${count === 1 ? "" : "s"}). ` +
            "Run `purdue-brightspace-update` in your terminal to update.";
        }
      }
    );
  });
}

export function getUpdateNotice(): string | null {
  const result = notice;
  notice = null;
  return result;
}
