import type { Locale } from "@repo/contents/_types/content";

/**
 * Dynamically imports a localized MDX content module.
 *
 * Keep this import relative. Turbopack expands alias-based template imports too
 * broadly here and can pull test-only files like `vitest.config.ts` into app
 * builds.
 *
 * @param cleanPath - Content slug relative to `packages/contents`
 * @param locale - Locale used to resolve the MDX file
 * @returns Imported MDX module namespace
 */
export async function importContentModule(cleanPath: string, locale: Locale) {
  return await import(`../${cleanPath}/${locale}.mdx`);
}

/**
 * Dynamically imports a references module for a content entry.
 *
 * Keep this import relative for the same reason as `importContentModule()`:
 * it keeps Turbopack's dynamic import context scoped to content files.
 *
 * @param cleanPath - Content slug relative to `packages/contents`
 * @returns Imported references module namespace
 */
export async function importReferencesModule(cleanPath: string) {
  return await import(`../${cleanPath}/ref.ts`);
}
