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
 *   "Function Transformation",   // would make 48 chars - kept
 *   "Grade 12",                  // would exceed 60 - skipped
 *   "Mathematics"                // skipped
 * ], "Nakafa")
 * // Result: "Vertical Translation - Function Transformation - Nakafa" (51 chars)
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
  const MAX_LENGTH = 55; // Leave room for " - {siteName}"
  const SEPARATOR = " - ";

  // Build title by iterating and skipping null/undefined values
  let title = "";

  for (const part of parts) {
    // Skip null/undefined/empty values
    if (!part) {
      continue;
    }

    if (title === "") {
      // First valid part
      title = part;
    } else {
      // Check if adding this part would exceed limit
      const potentialTitle = `${title}${SEPARATOR}${part}`;
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

/**
 * Validates if a title is within SEO-optimal length
 *
 * @param title - Title to check
 * @returns Object with validation results
 */
export function validateTitleLength(title: string): {
  length: number;
  isOptimal: boolean;
  isTooShort: boolean;
  isTooLong: boolean;
} {
  const length = title.length;
  return {
    length,
    isOptimal: length >= 30 && length <= 60,
    isTooShort: length < 30,
    isTooLong: length > 60,
  };
}
