import { extractText } from "unpdf";
import { log } from "./logger.js";

/**
 * Extract text content from a PDF buffer.
 * Returns null on failure (graceful degradation — download still works).
 */
export async function extractPdfText(
  buffer: Buffer
): Promise<{ text: string; totalPages: number } | null> {
  try {
    const result = await extractText(new Uint8Array(buffer), {
      mergePages: true,
    });
    return {
      text: result.text as string,
      totalPages: result.totalPages,
    };
  } catch (error) {
    log("ERROR", "Failed to extract text from PDF", error);
    return null;
  }
}
