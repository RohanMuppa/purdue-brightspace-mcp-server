/**
 * Brightspace MCP Server
 * Copyright (c) 2025 Rohan Muppa. All rights reserved.
 * Licensed under AGPL-3.0 — see LICENSE file for details.
 */

import * as path from "node:path";
import * as os from "node:os";
import type { AppConfig } from "../types/index.js";

export function loadConfig(): AppConfig {
  const sessionDir = process.env.D2L_SESSION_DIR
    ? expandTilde(process.env.D2L_SESSION_DIR)
    : path.join(os.homedir(), ".d2l-session");

  return {
    baseUrl: process.env.D2L_BASE_URL || "https://purdue.brightspace.com",
    sessionDir,
    tokenTtl: parseInt(process.env.D2L_TOKEN_TTL || "3600", 10),
    headless: process.env.D2L_HEADLESS === "true",
    username: process.env.D2L_USERNAME,
    password: process.env.D2L_PASSWORD,
    totpSecret: process.env.MFA_TOTP_SECRET,
    courseFilter: {
      includeCourseIds: process.env.D2L_INCLUDE_COURSES
        ? process.env.D2L_INCLUDE_COURSES.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
        : undefined,
      excludeCourseIds: process.env.D2L_EXCLUDE_COURSES
        ? process.env.D2L_EXCLUDE_COURSES.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
        : undefined,
      activeOnly: process.env.D2L_ACTIVE_ONLY !== 'false', // default true
    },
  };
}

function expandTilde(filePath: string): string {
  if (filePath.startsWith("~")) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

export type { AppConfig };
