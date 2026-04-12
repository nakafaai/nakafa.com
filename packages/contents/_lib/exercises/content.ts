import { getScopedContent } from "@repo/contents/_lib/scoped";
import type { Locale } from "@repo/contents/_types/content";

/**
 * Loads one exercise entry with an import context restricted to `exercises/`.
 */
export function getExerciseContent(
  locale: Locale,
  filePath: string,
  options: { includeMDX?: boolean } = {}
) {
  return getScopedContent("exercises", locale, filePath, options);
}
