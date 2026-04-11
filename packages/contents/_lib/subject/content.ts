import {
  getScopedContent,
  getScopedContents,
} from "@repo/contents/_lib/scoped";
import type { Locale } from "@repo/contents/_types/content";

/**
 * Loads one subject entry with an import context restricted to `subject/`.
 */
export function getSubjectContent(
  locale: Locale,
  filePath: string,
  options: { includeMDX?: boolean } = {}
) {
  return getScopedContent("subject", locale, filePath, options);
}

/**
 * Loads all subject entries under one subject base path with an import context
 * restricted to `subject/`.
 */
export function getSubjectContents(
  options: { basePath?: string; includeMDX?: boolean; locale?: Locale } = {}
) {
  return getScopedContents("subject", options);
}
