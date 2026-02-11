/**
 * Purdue Brightspace MCP Server
 * Copyright (c) 2025 Rohan Muppa. All rights reserved.
 * Licensed under AGPL-3.0 — see LICENSE file for details.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { D2LApiClient } from "../api/index.js";
import { DownloadFileSchema } from "./schemas.js";
import { toolResponse, sanitizeError, errorResponse } from "./tool-helpers.js";
import { log } from "../utils/logger.js";
import {
  validateDownloadPath,
  validateFileType,
  validateContentId,
  MAX_FILE_SIZE,
} from "../utils/file-validator.js";
import { secureDownload } from "../utils/download-helpers.js";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Register download_file tool
 */
export function registerDownloadFile(
  server: McpServer,
  apiClient: D2LApiClient
): void {
  server.registerTool(
    "download_file",
    {
      title: "Download File",
      description:
        "Download a file from course content or assignment submissions to a local directory. Use this when the user wants to download, save, or get a file from Brightspace course content or dropbox submissions. IMPORTANT: You MUST ask the user where they want to save the file before calling this tool. Never guess or assume a download directory.",
      inputSchema: DownloadFileSchema,
    },
    async (args: any) => {
      try {
        log("DEBUG", "download_file tool called", { args });

        // Parse and validate input
        const { courseId, topicId, folderId, fileId, downloadPath } =
          DownloadFileSchema.parse(args);

        // Validate courseId
        validateContentId(courseId);

        // Validate download path is absolute
        if (!path.isAbsolute(downloadPath)) {
          return errorResponse(
            "Download path must be an absolute path (e.g., /Users/username/Downloads on Mac or C:\\Users\\username\\Downloads on Windows)"
          );
        }

        // Validate download directory exists and is a directory
        try {
          const stats = await fs.stat(downloadPath);
          if (!stats.isDirectory()) {
            return errorResponse(
              `Download path is not a directory: ${downloadPath}`
            );
          }
        } catch (error: any) {
          if (error?.code === "ENOENT") {
            return errorResponse(
              `Download directory does not exist: ${downloadPath}`
            );
          }
          throw error;
        }

        // Determine download source
        if (topicId !== undefined) {
          // Content file download
          validateContentId(topicId);
          return await downloadContentFile(
            apiClient,
            courseId,
            topicId,
            downloadPath
          );
        } else if (folderId !== undefined && fileId !== undefined) {
          // Submission file download
          validateContentId(folderId);
          validateContentId(fileId);
          return await downloadSubmissionFile(
            apiClient,
            courseId,
            folderId,
            fileId,
            downloadPath
          );
        } else {
          return errorResponse(
            "Either topicId (for content files) or both folderId and fileId (for submission files) must be provided"
          );
        }
      } catch (error) {
        return sanitizeError(error);
      }
    }
  );
}

/**
 * Download a content file using topicId
 */
async function downloadContentFile(
  apiClient: D2LApiClient,
  courseId: number,
  topicId: number,
  downloadPath: string
): Promise<any> {
  log(
    "INFO",
    `Downloading content file: courseId=${courseId}, topicId=${topicId}`
  );

  // Build download URL using D2L API path helper
  const apiPath = apiClient.le(courseId, `/content/topics/${topicId}/file`);

  // Fetch file using getRaw (returns Response object, not parsed JSON)
  const response = await apiClient.getRaw(apiPath);

  // Check Content-Length BEFORE downloading body (prevent memory exhaustion)
  const contentLength = parseInt(
    response.headers.get("Content-Length") ?? "0",
    10
  );
  if (contentLength > MAX_FILE_SIZE) {
    return errorResponse(
      `File too large (${Math.round(contentLength / 1024 / 1024)}MB). Maximum allowed: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  // Get filename from Content-Disposition header
  const disposition = response.headers.get("Content-Disposition") ?? "";
  let filename = "download";
  const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  if (match?.[1]) {
    filename = match[1].replace(/['"]/g, "");
  }

  log("DEBUG", `Content-Disposition filename: ${filename}`);

  // Download body as buffer
  const buffer = Buffer.from(await response.arrayBuffer());

  // Double-check actual size
  if (buffer.length > MAX_FILE_SIZE) {
    return errorResponse(
      `File too large (${Math.round(buffer.length / 1024 / 1024)}MB). Maximum allowed: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  // Use secureDownload for path traversal prevention, file type validation, and conflict resolution
  const result = await secureDownload({
    targetDir: downloadPath,
    filename,
    data: buffer,
  });

  log(
    "INFO",
    `File downloaded successfully: ${result.path} (${result.size} bytes, ${result.mime})`
  );

  return toolResponse({
    success: true,
    filePath: result.path,
    fileSize: result.size,
    mimeType: result.mime,
    message: `File downloaded successfully to ${result.path}`,
  });
}

/**
 * Download a submission/feedback file using folderId + fileId
 */
async function downloadSubmissionFile(
  apiClient: D2LApiClient,
  courseId: number,
  folderId: number,
  fileId: number,
  downloadPath: string
): Promise<any> {
  log(
    "INFO",
    `Downloading submission file: courseId=${courseId}, folderId=${folderId}, fileId=${fileId}`
  );

  // D2L API pattern for submission file downloads:
  // GET /d2l/api/le/(version)/(orgUnitId)/dropbox/folders/(folderId)/submissions/mysubmissions/
  // Then find the file by fileId and construct its download URL

  // First, fetch the submission to get file metadata
  const submissionsPath = apiClient.le(
    courseId,
    `/dropbox/folders/${folderId}/submissions/mysubmissions/`
  );

  interface DropboxSubmission {
    Id: number;
    Files: Array<{
      FileId: number;
      FileName: string;
      Size: number;
    }>;
  }

  const submissions =
    await apiClient.get<DropboxSubmission[]>(submissionsPath);

  if (!submissions || submissions.length === 0) {
    return errorResponse(
      "No submissions found for this assignment. Upload a submission first."
    );
  }

  // Find the file in the submission
  const submission = submissions[0];
  const file = submission.Files.find((f) => f.FileId === fileId);

  if (!file) {
    return errorResponse(
      `File ID ${fileId} not found in submission. Available files: ${submission.Files.map((f) => `${f.FileName} (ID: ${f.FileId})`).join(", ")}`
    );
  }

  // Check file size before downloading
  if (file.Size > MAX_FILE_SIZE) {
    return errorResponse(
      `File too large (${Math.round(file.Size / 1024 / 1024)}MB). Maximum allowed: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  // D2L file download URL pattern for submission files
  // GET /d2l/api/le/(version)/(orgUnitId)/dropbox/folders/(folderId)/submissions/(submissionId)/files/(fileId)/download
  const downloadApiPath = apiClient.le(
    courseId,
    `/dropbox/folders/${folderId}/submissions/${submission.Id}/files/${fileId}/download`
  );

  // Fetch file
  const response = await apiClient.getRaw(downloadApiPath);

  // Download body as buffer
  const buffer = Buffer.from(await response.arrayBuffer());

  // Double-check actual size
  if (buffer.length > MAX_FILE_SIZE) {
    return errorResponse(
      `File too large (${Math.round(buffer.length / 1024 / 1024)}MB). Maximum allowed: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  // Use secureDownload for path traversal prevention, file type validation, and conflict resolution
  const result = await secureDownload({
    targetDir: downloadPath,
    filename: file.FileName,
    data: buffer,
  });

  log(
    "INFO",
    `Submission file downloaded successfully: ${result.path} (${result.size} bytes, ${result.mime})`
  );

  return toolResponse({
    success: true,
    filePath: result.path,
    fileSize: result.size,
    mimeType: result.mime,
    message: `File downloaded successfully to ${result.path}`,
  });
}
