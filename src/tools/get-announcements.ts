import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { D2LApiClient, DEFAULT_CACHE_TTLS } from "../api/index.js";
import {
  GetAnnouncementsSchema,
} from "./schemas.js";
import { toolResponse, sanitizeError } from "./tool-helpers.js";
import { log } from "../utils/logger.js";
import { applyCourseFilter } from "../utils/course-filter.js";
import type { AppConfig } from "../types/index.js";

interface NewsItem {
  Id: number;
  Title: string;
  Body: { Text: string; Html: string };
  CreatedBy: { Identifier: string; DisplayName: string };
  CreatedDate: string;
  LastModifiedBy: { Identifier: string; DisplayName: string };
  LastModifiedDate: string;
  StartDate: string;
  EndDate: string | null;
  IsPublished: boolean;
  IsPinned: boolean;
  IsGlobal: boolean;
  Attachments: any[];
}

interface EnrollmentItem {
  OrgUnit: {
    Id: number;
    Name: string;
    Code: string;
  };
  Access: {
    ClasslistRoleName: string;
    IsActive: boolean;
    LastAccessed: string | null;
  };
}

interface EnrollmentResponse {
  Items: EnrollmentItem[];
  PagingInfo?: {
    HasMoreItems: boolean;
    Bookmark?: string;
  };
}

/**
 * Register get_announcements tool
 */
export function registerGetAnnouncements(
  server: McpServer,
  apiClient: D2LApiClient,
  config: AppConfig
): void {
  server.registerTool(
    "get_announcements",
    {
      title: "Get Announcements",
      description:
        "Fetch recent announcements from your courses. Can filter to a specific course or get announcements across all courses. Use this when the user asks about announcements, news, updates from instructors, recent posts, or what professors said.",
      inputSchema: GetAnnouncementsSchema,
    },
    async (args: any) => {
      try {
        log("DEBUG", "get_announcements tool called", { args });

        // Parse and validate input
        const { courseId, count } = GetAnnouncementsSchema.parse(args);

        // Single course case
        if (courseId) {
          const path = apiClient.le(courseId, "/news/");
          const newsItems = await apiClient.get<NewsItem[]>(path, {
            ttl: DEFAULT_CACHE_TTLS.announcements,
          });

          // Map to clean objects
          const announcements = newsItems
            .map((item) => ({
              id: item.Id,
              title: item.Title,
              body: item.Body.Text,
              createdBy: item.CreatedBy.DisplayName,
              createdDate: item.CreatedDate,
              startDate: item.StartDate,
              isPinned: item.IsPinned,
            }))
            .sort(
              (a, b) =>
                new Date(b.createdDate).getTime() -
                new Date(a.createdDate).getTime()
            )
            .slice(0, count);

          log(
            "INFO",
            `get_announcements: Retrieved ${announcements.length} announcements for course ${courseId}`
          );
          return toolResponse(announcements);
        }

        // All courses case
        // First, fetch enrolled courses
        const enrollmentPath = apiClient.lp(
          "/enrollments/myenrollments/?orgUnitTypeId=3&isActive=true"
        );
        const enrollmentResponse = await apiClient.get<EnrollmentResponse>(
          enrollmentPath,
          { ttl: DEFAULT_CACHE_TTLS.enrollments }
        );

        // Apply course filter
        const filteredEnrollments = applyCourseFilter(
          enrollmentResponse.Items.map(item => ({
            id: item.OrgUnit.Id,
            name: item.OrgUnit.Name,
            code: item.OrgUnit.Code,
            isActive: item.Access.IsActive,
            ...item,
          })),
          config.courseFilter
        );

        // Fetch announcements for each course (handle 403s gracefully)
        const announcementPromises = filteredEnrollments.map(
          async (item) => {
            try {
              const path = apiClient.le(item.OrgUnit.Id, "/news/");
              const newsItems = await apiClient.get<NewsItem[]>(path, {
                ttl: DEFAULT_CACHE_TTLS.announcements,
              });

              return newsItems.map((newsItem) => ({
                id: newsItem.Id,
                title: newsItem.Title,
                body: newsItem.Body.Text,
                createdBy: newsItem.CreatedBy.DisplayName,
                createdDate: newsItem.CreatedDate,
                startDate: newsItem.StartDate,
                isPinned: newsItem.IsPinned,
                courseId: item.OrgUnit.Id,
                courseName: item.OrgUnit.Name,
              }));
            } catch (error: any) {
              // 403 means no access (past course, etc) - log and skip
              if (error?.status === 403) {
                log(
                  "DEBUG",
                  `get_announcements: 403 Forbidden for course ${item.OrgUnit.Id} (${item.OrgUnit.Name}) - skipping`
                );
                return [];
              }
              throw error; // Re-throw other errors
            }
          }
        );

        const results = await Promise.allSettled(announcementPromises);
        const allAnnouncements = results
          .filter(
            (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled"
          )
          .flatMap((r) => r.value);

        // Sort by created date and slice to count
        const announcements = allAnnouncements
          .sort(
            (a, b) =>
              new Date(b.createdDate).getTime() -
              new Date(a.createdDate).getTime()
          )
          .slice(0, count);

        log(
          "INFO",
          `get_announcements: Retrieved ${announcements.length} announcements (out of ${allAnnouncements.length} total across ${enrollmentResponse.Items.length} courses)`
        );
        return toolResponse(announcements);
      } catch (error) {
        return sanitizeError(error);
      }
    }
  );
}
