import { z } from "zod";

/**
 * Zod schemas for MCP tool input validation.
 * Passed directly to MCP SDK as inputSchema — SDK detects Zod v4 via ._zod property.
 * Also used in tool handlers for runtime parsing via .parse(args).
 */

export const GetMyCoursesSchema = z.object({
  activeOnly: z.boolean().default(true).describe("Only return currently active courses"),
});

export const GetUpcomingDueDatesSchema = z.object({
  daysAhead: z.number().int().min(1).max(90).default(7).describe("Number of days ahead to look for due dates"),
  courseId: z.number().int().positive().optional().describe("Filter to a specific course ID"),
});

export const GetMyGradesSchema = z.object({
  courseId: z.number().int().positive().optional().describe("Course ID to get grades for. If omitted, returns grades for all enrolled courses."),
});

export const GetAnnouncementsSchema = z.object({
  courseId: z.number().int().positive().optional().describe("Course ID to get announcements for. If omitted, returns recent announcements across all courses."),
  count: z.number().int().min(1).max(50).default(10).describe("Maximum number of announcements to return"),
});
