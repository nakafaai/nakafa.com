import type { Locale } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import type { ComponentType } from "react";

const FILE_STEM_LOCALIZED_SEGMENTS = new Set(["answer", "question"]);

export interface ContentModule {
  default: ComponentType;
  metadata?: unknown;
}

/**
 * Builds the localized MDX file path for one content slug.
 *
 * Most content is authored as `slug/{locale}.mdx`. Typed practice assets keep
 * question and answer files beside choices as `question.{locale}.mdx` and
 * `answer.{locale}.mdx`, so their content slug points at the file stem.
 */
export function getLocalizedContentPath(cleanPath: string, locale: Locale) {
  const normalizedPath = cleanSlug(cleanPath);

  if (usesFileStemLocalizedContent(normalizedPath)) {
    return `${normalizedPath}.${locale}.mdx`;
  }

  return `${normalizedPath}/${locale}.mdx`;
}

/**
 * Detects practice MDX assets whose locale belongs in the filename stem so
 * dynamic imports match the authored question and answer file layout.
 */
function usesFileStemLocalizedContent(cleanPath: string) {
  const leafSegment = cleanPath.split("/").at(-1);

  return Boolean(leafSegment && FILE_STEM_LOCALIZED_SEGMENTS.has(leafSegment));
}

/**
 * Dynamically imports a localized MDX content module.
 *
 * This uses the exact MDX dynamic-import pattern documented by Next.js so the
 * bundler resolves the final content file path directly.
 *
 * @param cleanPath - Content slug relative to `packages/contents`
 * @param locale - Locale used to resolve the MDX file
 * @returns Imported MDX module namespace
 */
export function importContentModule(cleanPath: string, locale: Locale) {
  const normalizedPath = cleanSlug(cleanPath);

  if (usesFileStemLocalizedContent(normalizedPath)) {
    return import(`@repo/contents/${normalizedPath}.${locale}.mdx`);
  }

  return import(`@repo/contents/${normalizedPath}/${locale}.mdx`);
}
