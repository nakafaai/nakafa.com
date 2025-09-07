/**
 * Normalizes text by applying various character replacements
 * commonly found in AI responses or user input
 */

// Normalization rules - easy to extend
const NORMALIZATION_RULES = [
  // Full-width brackets to regular brackets with space
  { from: /\u3010/g, to: " [" }, // 【 -> [
  { from: /\u3011/g, to: "]" }, // 】 -> ]

  // Add more normalization rules here as needed:
  // { from: /pattern/g, to: "replacement" },
] as const;

/**
 * Normalizes text by applying all defined normalization rules
 * @param str - The string to normalize
 * @returns The normalized string
 */
export function normalizeText(str: string): string {
  return NORMALIZATION_RULES.reduce(
    (text, rule) => text.replace(rule.from, rule.to),
    str
  );
}
