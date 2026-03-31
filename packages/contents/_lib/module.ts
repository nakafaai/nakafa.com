import type { Locale } from "@repo/contents/_types/content";
import type { ComponentType } from "react";

const CONTENT_ROOTS = ["articles", "exercises", "subject"] as const;

type ContentRoot = (typeof CONTENT_ROOTS)[number];

interface ContentModule {
  default: ComponentType;
  metadata?: unknown;
}

interface ReferencesModule {
  references?: unknown;
}

const contentRoots = new Set<string>(CONTENT_ROOTS);

const contentModuleImporters: Record<
  ContentRoot,
  (relativePath: string, locale: Locale) => Promise<ContentModule>
> = {
  articles: async (relativePath, locale) =>
    await import(`../articles/${relativePath}/${locale}.mdx`),
  exercises: async (relativePath, locale) =>
    await import(`../exercises/${relativePath}/${locale}.mdx`),
  subject: async (relativePath, locale) =>
    await import(`../subject/${relativePath}/${locale}.mdx`),
};

const referencesModuleImporters: Partial<
  Record<ContentRoot, (relativePath: string) => Promise<ReferencesModule>>
> = {
  articles: async (relativePath) =>
    await import(`../articles/${relativePath}/ref.ts`),
};

/**
 * Checks whether a slug root belongs to the supported content roots.
 *
 * @param root - First path segment from a normalized content slug
 * @returns True when the root is one of the supported content roots
 */
function isContentRoot(root: string): root is ContentRoot {
  return contentRoots.has(root);
}

/**
 * Splits a normalized content slug into its top-level content root and the
 * remaining relative path.
 *
 * Restricting dynamic imports to the real content roots keeps Turbopack's
 * import contexts narrower than a single catch-all template path.
 *
 * @param cleanPath - Content slug relative to `packages/contents`
 * @returns Root/path pair for supported content roots, else null
 */
function getContentModuleTarget(
  cleanPath: string
): { relativePath: string; root: ContentRoot } | null {
  const [root, ...segments] = cleanPath.split("/");

  if (segments.length === 0 || !isContentRoot(root)) {
    return null;
  }

  return {
    root,
    relativePath: segments.join("/"),
  };
}

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
export function importContentModule(cleanPath: string, locale: Locale) {
  const target = getContentModuleTarget(cleanPath);

  if (!target) {
    throw new Error(`Unsupported content module path: ${cleanPath}`);
  }

  const importer = contentModuleImporters[target.root];

  return importer(target.relativePath, locale);
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
export function importReferencesModule(cleanPath: string) {
  const target = getContentModuleTarget(cleanPath);

  if (!target) {
    throw new Error(`Unsupported references module path: ${cleanPath}`);
  }

  const importer = referencesModuleImporters[target.root];

  if (!importer) {
    throw new Error(`Unsupported references module path: ${cleanPath}`);
  }

  return importer(target.relativePath);
}
