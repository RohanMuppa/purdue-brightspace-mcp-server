#!/usr/bin/env node
/** Brightspace MCP Server. Copyright (c) 2026 Rohan Muppa. MIT licensed. */

import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import dotenv from "dotenv";
import { loadConfig } from "./utils/config.js";
import { BrowserAuth, TokenManager } from "./auth/index.js";
import { NativeCredentialStoreError } from "./auth/credential-store.js";
import { retireLegacyProfile } from "./auth/legacy-profile.js";

dotenv.config({ quiet: true });
const pkg = JSON.parse(readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"));

async function requestMfaCode(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    while (true) {
      const code = (await rl.question("Enter the code from your authenticator app: ")).replace(/\s/g, "");
      if (/^\d{6,8}$/.test(code)) return code;
      console.error("Enter the 6-8 digit code shown by your authenticator app.");
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const automatic = process.argv.includes("--automatic");
  try {
    const config = await loadConfig();
    console.error(`\n=== Brightspace Authentication v${pkg.version} ===\n`);
    console.error(config.headless
      ? "Authentication runs headlessly. MFA numbers and code prompts appear here."
      : "Authentication opens a browser so you can complete MFA in the sign-in page.");

    const tokenManager = new TokenManager({
      sessionDir: config.sessionDir,
      baseUrl: config.baseUrl,
      tokenTtl: config.tokenTtl,
    });
    const codePrompt = config.headless && !automatic && process.stdin.isTTY ? requestMfaCode : undefined;
    await new BrowserAuth(config, codePrompt).authenticate({
      automatic,
      onAuthenticated: async (token) => {
        await tokenManager.setToken(token);
        await retireLegacyProfile(config.sessionDir);
        if (config.legacyBrowserStateMigrated && config.sessionRoot && config.sessionRoot !== config.sessionDir) {
          await retireLegacyProfile(config.sessionRoot);
        }
      },
    });
    console.error("\nAuthentication successful. Your encrypted session is ready for the MCP server.");
  } catch (error) {
    const code = (error as { code?: string })?.code;
    process.exitCode = error instanceof NativeCredentialStoreError ? 5
      : code === "AUTH_IN_PROGRESS" ? 2
      : code === "AUTH_COOLDOWN" ? 3
      : code === "AUTH_UNSUPPORTED" ? 4
      : code === "AUTH_TRANSPORT" ? 6 : 1;
    console.error("\nAuthentication failed:", error instanceof Error ? error.message : "Unknown authentication error");
    console.error("Run `npx brightspace-mcp-server setup` to update saved credentials.");
    console.error("Run `npx brightspace-mcp-server auth` to retry explicitly. This bypasses the automatic MFA cooldown.");
  }
}

await main();
