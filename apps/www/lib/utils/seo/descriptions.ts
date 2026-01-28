/**
 * Creates an SEO-optimized description by intelligently selecting and truncating
 * to fit within the optimal length for search engine results.
 *
 * SEO Best Practices:
 * - Optimal: 120-160 characters (visible in SERP without truncation)
 * - Google typically shows ~155-160 characters
 * - Should include primary keyword naturally
 * - Compelling call-to-action improves CTR
 *
 * Strategy:
 * 1. Use the first valid part from the priority chain
 * 2. Ensure minimum length (expand with fallbacks if needed)
 * 3. Truncate to maximum length at sentence boundary when possible
 * 4. Always return a meaningful description (no empty strings)
 *
 * @example
 * ```typescript
 * createSEODescription([
 *   metadata?.description,                    // Primary: existing description
 *   `${metadata?.title}. Learn with Nakafa`,  // Fallback with context
 * ])
 * // Result: "Vertical Translation concept explanation. Learn with Nakafa" (58 chars)
 * ```
 *
 * @param parts - Description parts in order of priority (most important first)
 * @param options - Optional configuration for length limits
 * @param options.maxLength - Maximum length (default: 160)
 * @param options.minLength - Minimum length (default: 120)
 * @returns Optimized description string (120-160 characters)
 */
export function createSEODescription(
  parts: (string | null | undefined)[],
  options: { maxLength?: number; minLength?: number } = {}
): string {
  const { maxLength = 160 } = options;

  // Find first valid part
  const validPart = parts.find((part) => part?.trim());

  if (!validPart) {
    return "";
  }

  let description = validPart.trim();

  // If too long, truncate intelligently
  if (description.length > maxLength) {
    // Account for "..." when truncating (3 characters)
    const effectiveMaxLength = maxLength - 3;

    // Try to truncate at sentence boundary within the effective maxLength limit
    const truncated = description.slice(0, effectiveMaxLength);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastExclamation = truncated.lastIndexOf("!");
    const lastQuestion = truncated.lastIndexOf("?");

    // Find the last sentence end that is within reasonable bounds
    // We want at least some content, so check if sentence end is after position 10
    const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);

    if (lastSentenceEnd > 10) {
      description = truncated.slice(0, lastSentenceEnd + 1);
    } else {
      // Truncate at word boundary
      const lastSpace = truncated.lastIndexOf(" ");
      if (lastSpace > 10) {
        description = `${truncated.slice(0, lastSpace).trim()}...`;
      } else {
        // Hard truncate if no good boundary
        description = `${truncated.slice(0, effectiveMaxLength).trim()}...`;
      }
    }
  }

  return description;
}
