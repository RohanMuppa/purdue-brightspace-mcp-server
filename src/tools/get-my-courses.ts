import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { D2LApiClient, DEFAULT_CACHE_TTLS } from "../api/index.js";
import {
  GetMyCoursesSchema,
} from "./schemas.js";
import { toolResponse, sanitizeError } from "./tool-helpers.js";
import { log } from "../utils/logger.js";
import { applyCourseFilter } from "../utils/course-filter.js";
import type { AppConfig } from "../types/index.js";

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
 * Register get_my_courses tool
 */
export function registerGetMyCourses(
  server: McpServer,
  apiClient: D2LApiClient,
  config: AppConfig
): void {
  server.registerTool(
    "get_my_courses",
    {
      title: "Get My Courses",
      description:
        "Fetch your enrolled Brightspace courses with names, codes, and IDs. Use activeOnly to filter to current semester.",
      inputSchema: GetMyCoursesSchema,
    },
    async (args: any) => {
      try {
        log("DEBUG", "get_my_courses tool called", { args });

        // Parse and validate input
        const { activeOnly } = GetMyCoursesSchema.parse(args);

        // Build path - orgUnitTypeId=3 means "Course Offering" type
        const path = apiClient.lp(
          `/enrollments/myenrollments/?orgUnitTypeId=3${activeOnly ? "&isActive=true" : ""}`
        );

        // Fetch enrollments
        const response = await apiClient.get<EnrollmentResponse>(path, {
          ttl: DEFAULT_CACHE_TTLS.enrollments,
        });

        // Check for pagination
        if (response.PagingInfo?.HasMoreItems) {
          log(
            "WARN",
            "get_my_courses: Pagination detected but not implemented. Some courses may be missing.",
            { hasMore: true }
          );
        }

        // Map to clean objects and apply course filter
        const courses = applyCourseFilter(
          response.Items.map((item) => ({
            id: item.OrgUnit.Id,
            name: item.OrgUnit.Name,
            code: item.OrgUnit.Code,
            role: item.Access.ClasslistRoleName,
            isActive: item.Access.IsActive,
            lastAccessed: item.Access.LastAccessed,
          })),
          config.courseFilter
        );

        log("INFO", `get_my_courses: Retrieved ${courses.length} courses`);
        return toolResponse(courses);
      } catch (error) {
        return sanitizeError(error);
      }
    }
  );
}
