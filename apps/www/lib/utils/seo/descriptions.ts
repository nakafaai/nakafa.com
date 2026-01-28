/**
 * Creates an SEO-optimized description by concatenating parts and truncating
 * at word boundary when exceeding max length.
 *
 * SEO Best Practices:
 * - Optimal: 120-160 characters (visible in SERP without truncation)
 * - Google typically shows ~155-160 characters
 * - Should include primary keyword naturally
 * - NO ellipsis (...) - Google prefers complete, natural descriptions
 *
 * How it works:
 * 1. Filters out null, undefined, and empty strings
 * 2. Joins valid parts with ". " separator
 * 3. If result exceeds maxLength, truncates at last word boundary
 * 4. Never adds ellipsis - clean cut only
 *
 * @example
 * ```typescript
 * createSEODescription([
 *   metadata?.description,
 *   `${metadata?.title} - Learn with Nakafa`,
 * ])
 * // Result: "Primary description text. Content Title - Learn with Nakafa"
 * ```
 *
 * @param parts - Description parts in order of priority (most important first)
 * @param options - Optional configuration
 * @param options.maxLength - Maximum length (default: 160)
 * @returns Optimized description string, clean without ellipsis
 */
export function createSEODescription(
  parts: (string | null | undefined)[],
  options: { maxLength?: number } = {}
): string {
  const { maxLength = 160 } = options;

  // Filter out invalid parts and trim
  const validParts = parts
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => part.trim());

  if (validParts.length === 0) {
    return "";
  }

  // Join all parts with ". " separator
  const joined = validParts.join(". ");

  // If under maxLength, return as-is
  if (joined.length <= maxLength) {
    return joined;
  }

  // Truncate at word boundary for clean cut (no ellipsis)
  const truncated = joined.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  // Only cut at word boundary if we have a reasonable amount of content
  if (lastSpace > 10) {
    return truncated.slice(0, lastSpace).trim();
  }

  // Hard truncate if no good word boundary found
  return truncated.trim();
}
