/**
 * Creates an SEO-optimized title by intelligently truncating to fit within
 * the optimal length while preserving the most important information.
 *
 * SEO Best Practices:
 * - Optimal: 30-60 characters (visible in SERP without truncation)
 * - Maximum: 60 characters before Google truncates with "..."
 *
 * Strategy:
 * 1. Always include the first part (content title - most important)
 * 2. Add context parts in order of importance until near limit
 * 3. Always append site name
 * 4. Prioritize keeping title complete over including all context
 *
 * @example
 * ```typescript
 * createSEOTitle([
 *   "Vertical Translation",      // 20 chars - kept
 *   "Function Transformation",   // 23 chars - kept
 *   "Grade 12",                  // skipped (would exceed 55 char limit)
 *   "Mathematics"                // skipped
 * ], "Nakafa")
 * // Result: "Vertical Translation - Function Transformation - Nakafa"
 * // Length: 20 + 3 + 23 + 3 + 6 = 55 chars (exactly at MAX_LENGTH)
 * ```
 *
 * @param parts - Title parts in order of importance (most important first), null/undefined values are filtered out
 * @param siteName - Site name to append (default: "Nakafa")
 * @returns Optimized title string (30-60 characters)
 */
export function createSEOTitle(
  parts: (string | null | undefined)[],
  siteName = "Nakafa"
): string {
  // MAX_LENGTH calculation:
  // Google truncates titles at ~60 chars. We use 55 to stay safely under.
  // Final format: "{parts} - {siteName}"
  // Overhead: " - " (3 chars) + "Nakafa" (6 chars) = 9 chars
  // So MAX_LENGTH = 55 means parts can use up to 46 chars (55 - 9)
  const MAX_LENGTH = 55;
  const SEPARATOR = " - ";

  // Build title by iterating and skipping null/undefined values
  let title = "";

  for (const part of parts) {
    // Skip null/undefined/empty values and whitespace-only strings
    // Check type first since trim() only exists on strings
    if (typeof part !== "string") {
      continue;
    }
    const trimmedPart = part.trim();
    if (!trimmedPart) {
      continue;
    }

    if (title === "") {
      // First valid part - apply smart truncation if needed
      const maxFirstPartLength =
        MAX_LENGTH - SEPARATOR.length - siteName.length;

      if (trimmedPart.length > maxFirstPartLength) {
        // Smart truncation: find last space before limit to preserve whole words
        const truncated = trimmedPart.slice(0, maxFirstPartLength);
        const lastSpaceIndex = truncated.lastIndexOf(" ");

        if (lastSpaceIndex > 0) {
          title = truncated.slice(0, lastSpaceIndex).trim();
        } else {
          // No space found, truncate at limit
          title = truncated.trim();
        }
      } else {
        title = trimmedPart;
      }
    } else {
      // Check if adding this part would exceed limit
      const potentialTitle = `${title}${SEPARATOR}${trimmedPart}`;
      const totalLength =
        potentialTitle.length + SEPARATOR.length + siteName.length;

      if (totalLength <= MAX_LENGTH) {
        title = potentialTitle;
      } else {
        // Would exceed limit, stop adding parts
        break;
      }
    }
  }

  // Return site name only if no valid parts found
  if (title === "") {
    return siteName;
  }

  return `${title}${SEPARATOR}${siteName}`;
}
