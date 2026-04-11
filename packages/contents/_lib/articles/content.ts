import {
  getScopedContent,
  getScopedContents,
  getScopedReferences,
} from "@repo/contents/_lib/scoped";
import type { Locale } from "@repo/contents/_types/content";

/**
 * Loads one article entry with an import context restricted to `articles/`.
 */
export function getArticleContent(
  locale: Locale,
  filePath: string,
  options: { includeMDX?: boolean } = {}
) {
  return getScopedContent("articles", locale, filePath, options);
}

/**
 * Loads all article entries under one article base path with an import context
 * restricted to `articles/`.
 */
export function getArticleContents(
  options: { basePath?: string; includeMDX?: boolean; locale?: Locale } = {}
) {
  return getScopedContents("articles", options);
}

/**
 * Loads article references with an import context restricted to `articles/`.
 */
export function getArticleReferences(filePath: string) {
  return getScopedReferences(
    "articles",
    /* istanbul ignore next: Vitest/Vite cannot execute nested variable dynamic imports here. */
    async (relativePath) =>
      await import(`../../articles/${relativePath}/ref.ts`),
    filePath
  );
}
