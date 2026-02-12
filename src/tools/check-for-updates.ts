/**
 * Purdue Brightspace MCP Server
 * Copyright (c) 2025 Rohan Muppa. All rights reserved.
 * Licensed under AGPL-3.0 — see LICENSE file for details.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { log } from "../utils/logger.js";

const CheckForUpdatesSchema = z.object({
  install: z.boolean().default(false)
    .describe("If true, install the update (git pull + npm install + rebuild). If false, just check."),
});

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function run(cmd: string): string {
  return execSync(cmd, {
    cwd: projectRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

/**
 * Register check_for_updates tool
 */
export function registerCheckForUpdates(server: McpServer): void {
  server.registerTool(
    "check_for_updates",
    {
      title: "Check for Updates",
      description:
        "Check if a newer version of the Purdue Brightspace MCP server is available and optionally install it. " +
        "Use this when the user asks to update, check for updates, or get the latest version.",
      inputSchema: CheckForUpdatesSchema,
    },
    async (args: any) => {
      try {
        const { install } = CheckForUpdatesSchema.parse(args);

        // Check if we're in a git repo
        try {
          run("git rev-parse --is-inside-work-tree");
        } catch {
          return {
            content: [{
              type: "text" as const,
              text: "Cannot check for updates: not installed via git. Re-clone the repository to enable updates.",
            }],
          };
        }

        // Get current version
        let currentVersion = "unknown";
        try {
          const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8"));
          currentVersion = pkg.version || "unknown";
        } catch { /* ignore */ }

        // Fetch latest
        try {
          run("git fetch origin main");
        } catch {
          return {
            content: [{
              type: "text" as const,
              text: "Cannot check for updates: failed to fetch from remote. Check your internet connection.",
            }],
            isError: true,
          };
        }

        // Check if behind
        const behindCount = run("git rev-list --count HEAD..origin/main");
        if (behindCount === "0") {
          return {
            content: [{
              type: "text" as const,
              text: `Already up to date! Current version: ${currentVersion}.`,
            }],
          };
        }

        // Get changelog
        const changelog = run("git log HEAD..origin/main --oneline");
        const commits = changelog.split("\n").map(line => `- ${line}`).join("\n");

        if (!install) {
          return {
            content: [{
              type: "text" as const,
              text: `Update available! ${behindCount} new commit${behindCount === "1" ? "" : "s"}:\n\n${commits}\n\nCurrent version: ${currentVersion}\n\nTo install, run \`npm run update\` in your terminal, or ask me to install the update.`,
            }],
          };
        }

        // Install the update
        log("INFO", "Installing update via MCP tool");

        // Check for uncommitted changes
        const status = run("git status --porcelain");
        if (status) {
          return {
            content: [{
              type: "text" as const,
              text: `Cannot install update: you have uncommitted changes in the project directory. Please commit or stash them first, then try again.\n\nPending update (${behindCount} commits):\n${commits}`,
            }],
            isError: true,
          };
        }

        // Pull
        try {
          run("git pull origin main");
        } catch {
          return {
            content: [{
              type: "text" as const,
              text: "Update failed: git pull encountered an error. Run `npm run update` manually in your terminal.",
            }],
            isError: true,
          };
        }

        // Install deps
        try {
          run("npm install");
        } catch {
          return {
            content: [{
              type: "text" as const,
              text: "Update pulled but npm install failed. Run `npm install && npm run build` manually in your terminal.",
            }],
            isError: true,
          };
        }

        // Build
        try {
          run("npm run build");
        } catch {
          return {
            content: [{
              type: "text" as const,
              text: "Update pulled and dependencies installed, but build failed. Run `npm run build` manually in your terminal.",
            }],
            isError: true,
          };
        }

        // Get new version
        let newVersion = "unknown";
        try {
          const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8"));
          newVersion = pkg.version || "unknown";
        } catch { /* ignore */ }

        const versionMsg = newVersion !== currentVersion
          ? `Version: ${currentVersion} → ${newVersion}`
          : `Version: ${newVersion}`;

        log("INFO", "Update installed successfully via MCP tool");

        return {
          content: [{
            type: "text" as const,
            text: `Update installed successfully! ${behindCount} commit${behindCount === "1" ? "" : "s"} applied.\n\n${commits}\n\n${versionMsg}\n\nRestart your MCP client to use the latest version.`,
          }],
        };
      } catch (error) {
        log("ERROR", "check_for_updates failed", error);
        return {
          content: [{
            type: "text" as const,
            text: "Failed to check for updates. Run `npm run update` manually in your terminal.",
          }],
          isError: true,
        };
      }
    }
  );
}
