// Tool registration functions - barrel export
export { registerGetMyCourses } from "./get-my-courses.js";
export { registerGetUpcomingDueDates } from "./get-upcoming-due-dates.js";
export { registerGetMyGrades } from "./get-my-grades.js";
export { registerGetAnnouncements } from "./get-announcements.js";
export { registerGetAssignments } from "./get-assignments.js";

// Re-export shared helpers and schemas for convenience
export { toolResponse, errorResponse, sanitizeError } from "./tool-helpers.js";
export * from "./schemas.js";
