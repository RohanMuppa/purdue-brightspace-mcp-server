/**
 * Background npm update checker — non-blocking fetch on startup.
 * Compares installed version against latest on npm registry.
 * If a newer version exists, auto-updates (clears npx cache or
 * runs npm install -g) so the next launch picks up the new version.
 */

import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, sep } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(__filename), "..", "..");

let notice: string | null = null;

function getInstalledVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf-8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function isNpxCache(): boolean {
  const normalized = projectRoot.split(sep).join("/");
  return /[\\/]_npx[\\/][^\\/]+[\\/]node_modules[\\/]brightspace-mcp-server/.test(normalized);
}

function getNpxHashDir(): string {
  return resolve(projectRoot, "..", "..");
}

const FALLBACK_MSG = (old: string, latest: string) =>
  `Update available: v${old} → v${latest}. ` +
  "Run `npx brightspace-mcp-server@latest` or clear your npx cache to update.";

export function initUpdateChecker(): void {
  const installed = getInstalledVersion();

  execFile("npm", ["view", "brightspace-mcp-server", "version"], { timeout: 10000, shell: true }, (err, stdout) => {
    if (err) return;
    const latest = stdout.trim();
    if (!latest || latest === installed) return;

    if (isNpxCache()) {
      const hashDir = getNpxHashDir();
      rm(hashDir, { recursive: true, force: true })
        .then(() => {
          notice =
            `Auto-updated: npx cache cleared (v${installed} → v${latest}). ` +
            "The new version will be downloaded on next restart.";
        })
        .catch(() => {
          notice = FALLBACK_MSG(installed, latest);
        });
    } else {
      execFile("npm", ["install", "-g", "brightspace-mcp-server@latest"], { timeout: 60000, shell: true }, (installErr) => {
        if (installErr) {
          notice = FALLBACK_MSG(installed, latest);
        } else {
          notice =
            `Auto-updated from v${installed} to v${latest}. ` +
            "Restart your MCP client to use the new version.";
        }
      });
    }
  });
}

export function getUpdateNotice(): string | null {
  const result = notice;
  notice = null;
  return result;
}
