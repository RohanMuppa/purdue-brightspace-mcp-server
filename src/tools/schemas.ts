/**
 * Purdue Brightspace MCP Server
 * Copyright (c) 2025 Rohan Muppa. All rights reserved.
 * Licensed under AGPL-3.0 — see LICENSE file for details.
 */

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

export const GetAssignmentsSchema = z.object({
  courseId: z.number().int().positive().optional()
    .describe("Course ID to get assignments for. If omitted, returns assignments for all enrolled courses."),
});

export const GetCourseContentSchema = z.object({
  courseId: z.number().int().positive()
    .describe("Course ID to get content tree for."),
  typeFilter: z.enum(["file", "link", "html", "video", "all"]).default("all").optional()
    .describe("Optional filter to narrow results by content type."),
  moduleTitle: z.string().optional()
    .describe("Case-insensitive substring match on module titles. Only returns modules whose title contains this string (e.g. 'Labs', 'Staff', 'Homeworks'). Children of matching modules are included in full."),
  maxDepth: z.number().int().min(1).max(10).optional()
    .describe("Limit recursive depth of the content tree. Depth 1 returns top-level modules with direct children only. Useful for getting a table of contents without all nested content."),
});

export const GetClasslistEmailsSchema = z.object({
  courseId: z.number().int().positive()
    .describe("Course ID to get emails for."),
});

export const DownloadFileSchema = z.object({
  courseId: z.number().int().positive()
    .describe("Course ID the file belongs to."),
  topicId: z.number().int().positive().optional()
    .describe("Content topic ID to download (for course content files)."),
  folderId: z.number().int().positive().optional()
    .describe("Dropbox folder ID (for submission/feedback file downloads)."),
  fileId: z.number().int().positive().optional()
    .describe("Specific file ID within a dropbox submission."),
  downloadPath: z.string().min(1)
    .describe("Absolute path to the directory where the file should be saved."),
  customFilename: z.string().optional()
    .describe("Custom filename for the downloaded file (include extension). If not provided, uses the original filename from Brightspace."),
});

export const GetSyllabusSchema = z.object({
  courseId: z.number().int().positive()
    .describe("Course ID to get syllabus for."),
  downloadPath: z.string().min(1).optional()
    .describe("Absolute path to the directory where the attachment should be saved."),
});

export const GetDiscussionsSchema = z.object({
  courseId: z.number().int().positive()
    .describe("Course ID to get discussion boards for."),
  forumId: z.number().int().positive().optional()
    .describe("Specific forum ID to get topics and posts for. If omitted, returns all forums."),
  topicId: z.number().int().positive().optional()
    .describe("Specific topic ID to get posts for. Requires forumId."),
});

export const GetRosterSchema = z.object({
  courseId: z.number().int().positive()
    .describe("Course ID to get roster for."),
  includeStudents: z.boolean().default(false)
    .describe("Include students in results. Default is instructors and TAs only."),
  searchTerm: z.string().optional()
    .describe("Optional search term to filter by name."),
});
