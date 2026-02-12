/**
 * Purdue Brightspace MCP Server
 * Copyright (c) 2025 Rohan Muppa. All rights reserved.
 * Licensed under AGPL-3.0 — see LICENSE file for details.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { D2LApiClient, DEFAULT_CACHE_TTLS } from "../api/index.js";
import {
  GetUpcomingDueDatesSchema,
} from "./schemas.js";
import { toolResponse, sanitizeError } from "./tool-helpers.js";
import { log } from "../utils/logger.js";
import { applyCourseFilter } from "../utils/course-filter.js";
import type { AppConfig } from "../types/index.js";

interface EventDataInfo {
  CalendarEventId: string;
  Title: string;
  OrgUnitName: string;
  OrgUnitId: number;
  StartDateTime: string;
  EndDateTime: string;
  IsAllDayEvent: boolean;
}

interface EnrollmentItem {
  OrgUnit: {
    Id: number;
    Name: string;
    Code: string;
  };
  Access: {
    IsActive: boolean;
  };
}

interface EnrollmentResponse {
  Items: EnrollmentItem[];
}

/**
 * Register get_upcoming_due_dates tool
 */
export function registerGetUpcomingDueDates(
  server: McpServer,
  apiClient: D2LApiClient,
  config: AppConfig
): void {
  server.registerTool(
    "get_upcoming_due_dates",
    {
      title: "Get Upcoming Due Dates",
      description:
        "Fetch upcoming due dates across all your courses. Shows assignments, quizzes, and other items due within the specified time window. Use this when the user asks about deadlines, what's due, upcoming work, or what they need to do this week.",
      inputSchema: GetUpcomingDueDatesSchema,
    },
    async (args: any) => {
      try {
        log("DEBUG", "get_upcoming_due_dates tool called", { args });

        // Parse and validate input
        const { daysAhead, courseId } = GetUpcomingDueDatesSchema.parse(args);

        // Build time window
        const now = new Date();
        const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

        const startDateTime = now.toISOString();
        const endDateTime = endDate.toISOString();

        // D2L calendar API requires orgUnitIdsCSV — fetch enrolled course IDs if not provided
        let orgUnitIds: string;
        if (courseId) {
          orgUnitIds = String(courseId);
        } else {
          const enrollments = await apiClient.get<{ Items: EnrollmentItem[] }>(
            apiClient.lp(`/enrollments/myenrollments/?orgUnitTypeId=3&isActive=true`),
            { ttl: DEFAULT_CACHE_TTLS.enrollments }
          );

          // Apply course filter
          const filteredEnrollments = applyCourseFilter(
            enrollments.Items.map(item => ({
              id: item.OrgUnit.Id,
              name: item.OrgUnit.Name,
              code: item.OrgUnit.Code,
              isActive: item.Access.IsActive,
            })),
            config.courseFilter
          );

          orgUnitIds = filteredEnrollments.map((e) => e.id).join(",");
        }

        log("DEBUG", `get_upcoming_due_dates: querying orgUnitIds=${orgUnitIds}, window=${startDateTime} to ${endDateTime}`);

        // Build path
        const path = apiClient.leGlobal(
          `/calendar/events/myEvents/?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}&orgUnitIdsCSV=${orgUnitIds}`
        );

        // Fetch events — D2L returns ObjectListPage wrapper with "Objects" array (NOT "Items")
        const response = await apiClient.get<{ Objects: EventDataInfo[]; Next: string | null }>(path, {
          ttl: DEFAULT_CACHE_TTLS.assignments,
        });
        const events = response.Objects ?? [];
        log("DEBUG", `get_upcoming_due_dates: raw response keys=${Object.keys(response).join(",")}, event count=${events.length}`);

        // Map to clean objects and sort by end date (soonest due first)
        const mappedEvents = events
          .map((event) => ({
            id: event.CalendarEventId,
            title: event.Title,
            courseName: event.OrgUnitName,
            courseId: event.OrgUnitId,
            startDate: event.StartDateTime,
            endDate: event.EndDateTime,
            isAllDay: event.IsAllDayEvent,
          }))
          .sort(
            (a, b) =>
              new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
          );

        log(
          "INFO",
          `get_upcoming_due_dates: Retrieved ${mappedEvents.length} events`
        );
        return toolResponse(mappedEvents);
      } catch (error) {
        return sanitizeError(error);
      }
    }
  );
}
