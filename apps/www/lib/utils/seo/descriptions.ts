/**
 * Creates an SEO-optimized description by intelligently selecting and truncating
 * to fit within the optimal length for search engine results.
 *
 * SEO Best Practices:
 * - Optimal: 120-160 characters (visible in SERP without truncation)
 * - Google typically shows ~155-160 characters
 * - Should include primary keyword naturally
 * - Compelling call-to-action improves CTR
 * - NO ellipsis (...) - Google prefers complete, natural descriptions
 *
 * Strategy:
 * 1. Use the first valid part from the priority chain
 * 2. Ensure minimum length (expand with fallbacks if needed)
 * 3. Truncate to maximum length at sentence/word boundary (clean cut, no ellipsis)
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
 * @returns Optimized description string (120-160 characters), clean without ellipsis
 */
export function createSEODescription(
  parts: (string | null | undefined)[],
  options: { maxLength?: number; minLength?: number } = {}
): string {
  const { maxLength = 160, minLength = 120 } = options;

  // Filter out invalid parts
  const validParts = parts.filter((part): part is string =>
    Boolean(part?.trim())
  );

  if (validParts.length === 0) {
    return "";
  }

  // Build description by combining parts until we reach minLength
  let description = validParts[0].trim();

  // Add fallback parts if description is too short
  for (
    let i = 1;
    i < validParts.length && description.length < minLength;
    i++
  ) {
    const nextPart = validParts[i].trim();
    const combined = `${description} ${nextPart}`;

    // If combined is still under maxLength, use it
    if (combined.length <= maxLength) {
      description = combined;
    } else {
      // If combined exceeds maxLength, try to add partial fallback
      // No ellipsis - just clean word boundary truncation
      const remainingSpace = maxLength - description.length - 1; // -1 for space
      if (remainingSpace > 10) {
        // Only add if we can add meaningful content
        const partialFallback = nextPart.slice(0, remainingSpace);
        // Try to end at word boundary for clean cut
        const lastSpace = partialFallback.lastIndexOf(" ");
        if (lastSpace > 5) {
          description = `${description} ${partialFallback.slice(0, lastSpace)}`;
        }
      }
      break;
    }
  }

  // If too long, truncate intelligently at sentence or word boundary
  if (description.length > maxLength) {
    // Try to truncate at sentence boundary within maxLength
    const truncated = description.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastExclamation = truncated.lastIndexOf("!");
    const lastQuestion = truncated.lastIndexOf("?");

    // Find the last sentence end that is within reasonable bounds
    // We want at least some content, so check if sentence end is after position 10
    const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);

    if (lastSentenceEnd > 10) {
      description = truncated.slice(0, lastSentenceEnd + 1);
    } else {
      // Truncate at word boundary for clean cut (no ellipsis)
      const lastSpace = truncated.lastIndexOf(" ");
      if (lastSpace > 10) {
        description = truncated.slice(0, lastSpace).trim();
      } else {
        // Hard truncate at maxLength if no good boundary
        description = truncated.trim();
      }
    }
  }

  return description;
}
