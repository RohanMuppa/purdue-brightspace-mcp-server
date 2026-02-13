#!/usr/bin/env node
/**
 * Purdue Brightspace MCP Server
 * Copyright (c) 2026 Rohan Muppa. All rights reserved.
 * Licensed under AGPL-3.0 — see LICENSE file for details.
 *
 * https://github.com/rohanmuppa/purdue-brightspace-mcp
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ quiet: true } as Parameters<typeof dotenv.config>[0]);

// ANSI color helpers
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd: string, opts?: { silent?: boolean }): string {
  try {
    return execSync(cmd, {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: opts?.silent ? ["pipe", "pipe", "pipe"] : ["pipe", "pipe", "inherit"],
    }).trim();
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string };
    throw new Error(error.stderr || error.message || "Command failed");
  }
}

function getVersion(): string {
  const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8"));
  return pkg.version || "unknown";
}

function main(): void {
  console.log("");
  console.log(bold("=== Purdue Brightspace MCP — Update ==="));
  console.log("");

  // Check if we're in a git repo
  try {
    run("git rev-parse --is-inside-work-tree", { silent: true });
  } catch {
    console.error(red("Error: Not a git repository. Cannot update."));
    console.error("Make sure you cloned this project with git.");
    process.exit(1);
  }

  // Show current version
  const currentVersion = getVersion();
  console.log(`  Current version: ${bold(currentVersion)}`);
  console.log("");

  // Check for uncommitted changes
  const status = run("git status --porcelain", { silent: true });
  if (status) {
    console.log(yellow("  Warning: You have uncommitted changes."));
    console.log(dim("  The update will proceed, but your local changes may conflict."));
    console.log("");
  }

  // Fetch latest from remote
  console.log(dim("  Fetching latest changes..."));
  try {
    run("git fetch origin main", { silent: true });
  } catch {
    console.error(red("  Error: Failed to fetch from remote."));
    console.error("  Check your network connection and try again.");
    process.exit(1);
  }

  // Check if we're behind
  const behindCount = run("git rev-list --count HEAD..origin/main", { silent: true });
  if (behindCount === "0") {
    console.log("");
    console.log(green("  Already up to date!"));
    console.log("");
    return;
  }

  // Show what's new
  console.log("");
  console.log(bold(`  ${behindCount} new commit${behindCount === "1" ? "" : "s"}:`));
  console.log("");
  const log = run("git log HEAD..origin/main --oneline", { silent: true });
  for (const line of log.split("\n")) {
    console.log(`    ${dim("•")} ${line}`);
  }
  console.log("");

  // Pull changes
  console.log(dim("  Pulling changes..."));
  try {
    run("git pull origin main", { silent: true });
  } catch {
    console.error(red("  Error: Failed to pull changes."));
    console.error("  You may have merge conflicts. Resolve them manually and try again.");
    process.exit(1);
  }

  // Install dependencies
  console.log(dim("  Installing dependencies..."));
  try {
    run("npm install", { silent: true });
  } catch {
    console.error(red("  Error: Failed to install dependencies."));
    process.exit(1);
  }

  // Build
  console.log(dim("  Building..."));
  try {
    run("npm run build", { silent: true });
  } catch {
    console.error(red("  Error: Build failed."));
    process.exit(1);
  }

  // Show new version
  const newVersion = getVersion();
  console.log("");
  console.log(green("  Update complete!"));
  if (newVersion !== currentVersion) {
    console.log(`  Version: ${currentVersion} → ${bold(newVersion)}`);
  }
  console.log("");
  console.log("  Restart your MCP client to use the latest version.");
  console.log("");
}

main();
