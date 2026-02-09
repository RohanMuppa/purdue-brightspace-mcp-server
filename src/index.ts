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
  registerGetCourseContent,
  registerDownloadFile,
  registerGetClasslistEmails,
  registerGetRoster,
  registerGetSyllabus,
} from "./tools/index.js";

// CRITICAL: Enable stdout guard IMMEDIATELY to prevent corruption of stdio transport
enableStdoutGuard();

// Unhandled rejection handler
process.on('unhandledRejection', (reason) => {
  log('ERROR', 'Unhandled promise rejection', reason);
});

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
      log("ERROR", "MCP server cannot start without API initialization. Exiting.");
      process.exit(1);
    }

    // Register check_auth tool (no input schema needed for zero-argument tool)
    server.registerTool(
      "check_auth",
      {
        title: "Check Authentication Status",
        description:
          "Check if you are authenticated with Purdue Brightspace. Run the purdue-brightspace-auth CLI first to authenticate. Use this when the user asks if they're logged in, if authentication is working, or when other tools return auth errors.",
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

    // Log active course filter config if any filter is set
    if (config.courseFilter.includeCourseIds || config.courseFilter.excludeCourseIds || !config.courseFilter.activeOnly) {
      log("DEBUG", "Course filter config", {
        include: config.courseFilter.includeCourseIds,
        exclude: config.courseFilter.excludeCourseIds,
        activeOnly: config.courseFilter.activeOnly,
      });
    }

    // Register MCP tools
    registerGetMyCourses(server, apiClient, config);
    registerGetUpcomingDueDates(server, apiClient, config);
    registerGetMyGrades(server, apiClient, config);
    registerGetAnnouncements(server, apiClient, config);
    registerGetAssignments(server, apiClient, config);
    registerGetCourseContent(server, apiClient);
    registerDownloadFile(server, apiClient);
    registerGetClasslistEmails(server, apiClient);
    registerGetRoster(server, apiClient);
    registerGetSyllabus(server, apiClient);
    log("DEBUG", "MCP tools registered (10 core tools, total 11 with check_auth)");

    // Connect stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    log("INFO", "Purdue Brightspace MCP Server running on stdio (11 tools registered)");
    log("INFO", "Claude Desktop setup: see claude-desktop-config.example.json in the project root");
  } catch (error) {
    log("ERROR", "MCP Server failed to start", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  log('INFO', 'Shutting down MCP server');
  process.exit(0);
});
process.on('SIGTERM', () => {
  log('INFO', 'Shutting down MCP server');
  process.exit(0);
});

main();
