import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { D2LApiClient, DEFAULT_CACHE_TTLS } from "../api/index.js";
import { GetClasslistEmailsSchema } from "./schemas.js";
import { toolResponse, sanitizeError } from "./tool-helpers.js";
import { log } from "../utils/logger.js";

interface ClasslistUser {
  Identifier: number;
  DisplayName: string;
  Email: string | null;
  ClasslistRoleDisplayName: string;
}

interface ClasslistResponse {
  Objects: ClasslistUser[];
  Next?: string | null;
}

/**
 * Register get_classlist_emails tool
 */
export function registerGetClasslistEmails(
  server: McpServer,
  apiClient: D2LApiClient
): void {
  server.registerTool(
    "get_classlist_emails",
    {
      title: "Get Classlist Emails",
      description:
        "Fetch all email addresses for everyone in a course — instructors, TAs, and students. " +
        "Use this when the user wants a list of emails for a class, needs to email the whole class, " +
        "or wants contact info for everyone enrolled.",
      inputSchema: GetClasslistEmailsSchema,
    },
    async (args: any) => {
      try {
        log("DEBUG", "get_classlist_emails tool called", { args });

        const { courseId } = GetClasslistEmailsSchema.parse(args);

        // Fetch full classlist (all roles) using paged endpoint
        const path = apiClient.le(courseId, "/classlist/paged/");
        const response = await apiClient.get<ClasslistResponse>(path, {
          ttl: DEFAULT_CACHE_TTLS.roster,
        });

        if (response.Next) {
          log(
            "WARN",
            "get_classlist_emails: Pagination detected but not implemented. Some users may be missing.",
            { courseId, next: response.Next }
          );
        }

        // Extract emails, filtering out nulls (privacy-hidden)
        const emails = response.Objects
          .filter((user) => user.Email)
          .map((user) => ({
            name: user.DisplayName,
            email: user.Email,
            role: user.ClasslistRoleDisplayName,
          }));

        log("INFO", `get_classlist_emails: ${emails.length} emails from ${response.Objects.length} users in course ${courseId}`);
        return toolResponse(emails);
      } catch (error) {
        return sanitizeError(error);
      }
    }
  );
}
