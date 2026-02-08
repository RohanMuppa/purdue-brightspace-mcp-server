#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { enableStdoutGuard, log } from "./utils/logger.js";
import { loadConfig } from "./utils/config.js";
import { TokenManager } from "./auth/index.js";
import { D2LApiClient } from "./api/index.js";
import {
  registerGetMyCourses,
  registerGetUpcomingDueDates,
  registerGetMyGrades,
  registerGetAnnouncements,
  registerGetAssignments,
} from "./tools/index.js";

// CRITICAL: Enable stdout guard IMMEDIATELY to prevent corruption of stdio transport
enableStdoutGuard();

async function main(): Promise<void> {
  try {
    // Load configuration
    const config = loadConfig();
    log("DEBUG", "Configuration loaded", { sessionDir: config.sessionDir });

    // Create MCP server instance
    const server = new McpServer({
      name: "purdue-brightspace",
      version: "1.0.0",
    });
    log("DEBUG", "MCP Server instance created");

    // Create TokenManager for reading cached tokens
    const tokenManager = new TokenManager(config.sessionDir);

    // Create D2L API Client
    const apiClient = new D2LApiClient({
      baseUrl: config.baseUrl,
      tokenManager,
    });

    // Initialize API client (discover API versions)
    try {
      await apiClient.initialize();
      log("INFO", "D2L API Client initialized");
    } catch (error) {
      log("ERROR", "Failed to initialize D2L API Client", error);
      log(
        "WARN",
        "MCP server will start but tools may not work. Check your connection to Brightspace."
      );
    }

    // Register check_auth tool (no input schema needed for zero-argument tool)
    server.registerTool(
      "check_auth",
      {
        title: "Check Authentication Status",
        description:
          "Check if you are authenticated with Purdue Brightspace. Run the purdue-brightspace-auth CLI first to authenticate.",
      },
      async () => {
        log("DEBUG", "check_auth tool called");

        const token = await tokenManager.getToken();

        if (!token) {
          log("INFO", "check_auth: No valid token found");
          return {
            content: [
              {
                type: "text",
                text: "Not authenticated. Run `purdue-brightspace-auth` to login.",
              },
            ],
          };
        }

        const expiresIn = Math.round((token.expiresAt - Date.now()) / 1000 / 60);
        log("INFO", `check_auth: Token valid, expires in ~${expiresIn} minutes`);

        return {
          content: [
            {
              type: "text",
              text: `Authenticated with Purdue Brightspace. Token expires in ~${expiresIn} minutes. Source: ${token.source}.`,
            },
          ],
        };
      }
    );

    log("DEBUG", "check_auth tool registered");

    // Register MCP tools
    registerGetMyCourses(server, apiClient);
    registerGetUpcomingDueDates(server, apiClient);
    registerGetMyGrades(server, apiClient);
    registerGetAnnouncements(server, apiClient);
    registerGetAssignments(server, apiClient);
    log("DEBUG", "MCP tools registered (5 core tools)");

    // Connect stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    log("INFO", "Purdue Brightspace MCP Server running on stdio (6 tools registered)");
    log("INFO", "Claude Desktop setup: see claude-desktop-config.example.json in the project root");
  } catch (error) {
    log("ERROR", "MCP Server failed to start", error);
    process.exit(1);
  }
}

main();
