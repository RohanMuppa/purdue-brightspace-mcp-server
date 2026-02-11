/**
 * Purdue Brightspace MCP Server
 * Copyright (c) 2025 Rohan Muppa. All rights reserved.
 * Licensed under AGPL-3.0 — see LICENSE file for details.
 */

import TurndownService from "turndown";

/**
 * Singleton TurndownService instance configured for converting D2L HTML to markdown.
 * Uses ATX-style headings (###) and fenced code blocks (```).
 */
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

/**
 * Convert D2L HTML content to clean markdown.
 * Returns both markdown (for LLM readability) and raw HTML (for fallback).
 *
 * @param html - Raw HTML string from D2L API (e.g., assignment instructions, content topics)
 * @returns Object with both markdown and html representations
 */
export function convertHtmlToMarkdown(
  html: string
): { markdown: string; html: string } {
  // Handle null/empty input
  if (!html || html.trim().length === 0) {
    return { markdown: "", html: "" };
  }

  try {
    const markdown = turndownService.turndown(html);
    return { markdown, html };
  } catch (error) {
    // If conversion fails, fallback to raw HTML
    return { markdown: html, html };
  }
}
