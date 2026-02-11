/**
 * Purdue Brightspace MCP Server
 * Copyright (c) 2025 Rohan Muppa. All rights reserved.
 * Licensed under AGPL-3.0 — see LICENSE file for details.
 */

import type { CourseFilterConfig } from "../types/index.js";
import { log } from "./logger.js";

interface FilterableCourse {
  id: number;
  isActive: boolean;
}

/**
 * Apply course filtering based on environment variable configuration.
 *
 * Filter priority:
 * 1. activeOnly — exclude inactive courses (default: true)
 * 2. includeCourseIds — whitelist (only these courses)
 * 3. excludeCourseIds — blacklist (remove these courses)
 *
 * Tool-level courseId params bypass this filter entirely —
 * if user explicitly requests courseId=X, honor it regardless of config.
 */
export function applyCourseFilter<T extends FilterableCourse>(
  courses: T[],
  config: CourseFilterConfig
): T[] {
  let filtered = courses;
  const originalCount = courses.length;

  if (config.activeOnly) {
    filtered = filtered.filter(c => c.isActive);
  }

  if (config.includeCourseIds && config.includeCourseIds.length > 0) {
    filtered = filtered.filter(c => config.includeCourseIds!.includes(c.id));
  }

  if (config.excludeCourseIds && config.excludeCourseIds.length > 0) {
    filtered = filtered.filter(c => !config.excludeCourseIds!.includes(c.id));
  }

  if (filtered.length !== originalCount) {
    log("DEBUG", `Course filter: ${originalCount} -> ${filtered.length} courses`, {
      activeOnly: config.activeOnly,
      include: config.includeCourseIds,
      exclude: config.excludeCourseIds,
    });
  }

  return filtered;
}
