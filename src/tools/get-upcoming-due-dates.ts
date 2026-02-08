import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { D2LApiClient, DEFAULT_CACHE_TTLS } from "../api/index.js";
import {
  GetUpcomingDueDatesSchema,
} from "./schemas.js";
import { toolResponse, sanitizeError } from "./tool-helpers.js";
import { log } from "../utils/logger.js";

interface EventDataInfo {
  CalendarEventId: string;
  Title: string;
  OrgUnitName: string;
  OrgUnitId: number;
  StartDateTime: string;
  EndDateTime: string;
  IsAllDayEvent: boolean;
}

/**
 * Register get_upcoming_due_dates tool
 */
export function registerGetUpcomingDueDates(
  server: McpServer,
  apiClient: D2LApiClient
): void {
  server.registerTool(
    "get_upcoming_due_dates",
    {
      title: "Get Upcoming Due Dates",
      description:
        "Fetch upcoming due dates across all your courses. Shows assignments, quizzes, and other items due within the specified time window.",
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

        // Build path
        let path = apiClient.leGlobal(
          `/calendar/events/myEvents/?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}`
        );

        if (courseId) {
          path += `&orgUnitIdsCSV=${courseId}`;
        }

        // Fetch events
        const events = await apiClient.get<EventDataInfo[]>(path, {
          ttl: DEFAULT_CACHE_TTLS.assignments,
        });

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
