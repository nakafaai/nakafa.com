import type { Locale } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import type { ComponentType } from "react";

export interface ContentModule {
  default: ComponentType;
  metadata?: unknown;
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
  return import(`@repo/contents/${cleanSlug(cleanPath)}/${locale}.mdx`);
}
