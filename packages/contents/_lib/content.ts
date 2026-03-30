import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { extractMetadata } from "@repo/contents/_lib/metadata";
import {
  importContentModule,
  importReferencesModule,
} from "@repo/contents/_lib/module";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import {
  FileReadError,
  GitHubFetchError,
  InvalidPathError,
  MetadataParseError,
  ModuleLoadError,
} from "@repo/contents/_shared/error";
import type { Locale } from "@repo/contents/_types/content";
import {
  type ContentListWithMDX,
  type ContentMetadata,
  ContentMetadataSchema,
  type ContentWithMDX,
  type Reference,
  ReferenceSchema,
  type RenderableContent,
} from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Either, Option } from "effect";
import ky from "ky";
import { createElement } from "react";

const contentsDir = resolveContentsDir(import.meta.url);

/**
 * Validates that a file path is safe and doesn't escape the base directory.
 * This is a security-critical function that prevents path traversal attacks.
 *
 * @param filePath - The file path to validate
 * @param basePath - The base directory that the path should be contained within
 * @returns Effect that resolves to the validated full path, or fails with InvalidPathError
 *
 * @example
 * ```ts
 * const fullPath = Effect.runPromise(validatePath("articles/test", "/base/dir"));
 * ```
 */
export function validatePath(
  filePath: string,
  basePath: string
): Effect.Effect<string, InvalidPathError> {
  const cleanPath = cleanSlug(filePath);

  const fullPath = path.join(basePath, cleanPath);

  if (!fullPath.startsWith(basePath)) {
    return Effect.fail(
      new InvalidPathError({
        path: filePath,
        reason: "Path traversal detected",
      })
    );
  }

  return Effect.succeed(fullPath);
}

/**
 * Fetches raw content from local filesystem or falls back to GitHub repository.
 * Prevents path traversal attacks by validating and sanitizing the file path.
 *
 * @param filePath - Relative path to the MDX file (e.g., "articles/politics/my-article")
 * @returns Effect that resolves to raw file content, or fails with InvalidPathError, FileReadError, or GitHubFetchError
 *
 * @example
 * ```ts
 * const content = Effect.runPromise(getRawContent("articles/politics/my-article"));
 * ```
 */
function getRawContent(
  filePath: string
): Effect.Effect<string, InvalidPathError | FileReadError | GitHubFetchError> {
  const cleanPath = cleanSlug(filePath);

  const fullPathEffect = validatePath(filePath, contentsDir);

  return Effect.flatMap(fullPathEffect, (fullPath) => {
    const readFileEffect = Effect.tryPromise({
      try: () => fsPromises.readFile(fullPath, "utf8"),
      catch: (error: unknown) =>
        new FileReadError({
          path: fullPath,
          cause: error,
        }),
    });

    const fetchFromGitHub = Effect.tryPromise({
      try: () =>
        ky
          .get(
            `https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/packages/contents/${cleanPath}`,
            { cache: "force-cache" }
          )
          .text(),
      catch: (error: unknown) =>
        new GitHubFetchError({
          url: `https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/packages/contents/${cleanPath}`,
          cause: error,
        }),
    });

    return Effect.catchAll(readFileEffect, () => fetchFromGitHub);
  });
}

/**
 * Loads a localized MDX module and validates its exported metadata for callers
 * that only need renderable content.
 *
 * This helper intentionally avoids reading the raw `.mdx` file so page render
 * paths can skip that extra filesystem work when the source text is unused.
 *
 * @param cleanPath - Normalized content slug without locale or extension
 * @param locale - Target locale used to resolve the MDX module
 * @returns Effect that resolves to validated metadata and compiled MDX content
 */
function loadRenderableContentModule(
  cleanPath: string,
  locale: Locale
): Effect.Effect<RenderableContent, MetadataParseError | ModuleLoadError> {
  return Effect.gen(function* () {
    const modulePath = `@repo/contents/${cleanPath}/${locale}.mdx`;

    const contentModule = yield* Effect.tryPromise({
      try: () => importContentModule(cleanPath, locale),
      catch: (error: unknown) =>
        new ModuleLoadError({
          path: modulePath,
          cause: error,
        }),
    });

    const metadata = yield* parseModuleMetadata(contentModule).pipe(
      Effect.mapError(
        (error) =>
          new MetadataParseError({
            path: modulePath,
            reason: error.reason,
          })
      )
    );

    return {
      metadata,
      default: createElement(contentModule.default),
    };
  });
}

/**
 * Optional filters and loading behavior for content list queries.
 */
export interface ContentOptions {
  basePath?: string;
  includeMDX?: boolean;
  locale?: Locale;
}

/**
 * Retrieves localized MDX content for render-only paths.
 *
 * Use this helper when a caller needs validated metadata and the compiled MDX
 * element but does not consume the raw MDX source. This keeps page-rendering
 * paths on the lighter module-import path while preserving the existing raw
 * loading behavior for tooling and export-style callers.
 *
 * @param locale - Target locale (e.g. "en", "id")
 * @param filePath - Relative path without locale or extension
 * @returns Effect that resolves to renderable metadata and optional MDX element
 */
export function getRenderableContent(
  locale: Locale,
  filePath: string
): Effect.Effect<
  RenderableContent,
  InvalidPathError | MetadataParseError | ModuleLoadError
> {
  const cleanPath = cleanSlug(filePath);
  const contentPath = `${cleanPath}/${locale}.mdx`;

  return Effect.gen(function* () {
    yield* validatePath(contentPath, contentsDir);

    return yield* loadRenderableContentModule(cleanPath, locale);
  });
}

/**
 * Retrieves MDX content for a specific locale and file path.
 * Returns parsed metadata, optional MDX component, and raw content.
 *
 * @param locale - Target locale (e.g., "en", "id")
 * @param filePath - Relative path without locale or extension (e.g., "articles/politics/my-article")
 * @param options - Optional configuration
 * @param options.includeMDX - Whether to load the MDX component (default: true)
 * @returns Effect that resolves to content object with metadata, optional MDX component, and raw content
 *
 * @example
 * ```ts
 * const content = Effect.runPromise(getContent("en", "articles/politics/my-article", { includeMDX: true }));
 * ```
 */
export function getContent(
  locale: Locale,
  filePath: string,
  options: { includeMDX?: boolean } = {}
): Effect.Effect<
  ContentWithMDX,
  | InvalidPathError
  | FileReadError
  | GitHubFetchError
  | MetadataParseError
  | ModuleLoadError
> {
  const { includeMDX = true } = options;
  const cleanPath = cleanSlug(filePath);
  const contentPath = `${cleanPath}/${locale}.mdx`;

  if (includeMDX) {
    return Effect.gen(function* () {
      yield* validatePath(contentPath, contentsDir);

      const [raw, renderableContent] = yield* Effect.all(
        [
          getRawContent(contentPath),
          loadRenderableContentModule(cleanPath, locale),
        ],
        { concurrency: "unbounded" }
      );

      return {
        ...renderableContent,
        raw,
      };
    });
  }

  return Effect.gen(function* () {
    const raw = yield* getRawContent(contentPath);

    const metadata = extractMetadata(raw);
    if (Option.isNone(metadata)) {
      return yield* Effect.fail(
        new MetadataParseError({
          path: contentPath,
          reason: "No metadata found",
        })
      );
    }

    return {
      metadata: metadata.value,
      raw,
    };
  });
}

/**
 * Retrieves all contents matching specified criteria from the MDX cache.
 * Filters by base path and locale, optionally including MDX components.
 * Uses concurrent execution for optimal performance when fetching multiple files.
 *
 * @param options - Configuration options
 * @param options.includeMDX - Whether to load MDX components (default: true)
 * @param options.locale - Target locale (default: "en")
 * @param options.basePath - Optional prefix to filter contents (e.g., "articles/politics")
 * @returns Effect that resolves to array of content objects with metadata, URL, slug, and optional MDX component
 *
 * @example
 * ```ts
 * const allPoliticsArticles = await Effect.runPromise(getContents({
 *   locale: "en",
 *   basePath: "articles/politics",
 *   includeMDX: false
 * }));
 * ```
 */
export function getContents(
  options: ContentOptions = {}
): Effect.Effect<ContentListWithMDX[], never, never> {
  const { includeMDX = true, locale = "en", basePath = "" } = options;

  const slugs = getMDXSlugsForLocale(locale);

  const filteredSlugs = basePath
    ? slugs.filter((slug) => slug.startsWith(basePath))
    : slugs;

  function processSlug(slug: string, contentLocale: Locale) {
    return Effect.gen(function* () {
      const loc: Locale = contentLocale;
      const content = yield* Effect.either(
        getContent(loc, slug, { includeMDX })
      );

      if (Either.isLeft(content)) {
        return undefined;
      }

      const url = new URL(`/${loc}/${slug}`, "https://nakafa.com");

      const result: ContentListWithMDX = {
        metadata: content.right.metadata,
        raw: content.right.raw,
        url: url.toString(),
        slug,
        locale: loc,
      };

      return result;
    });
  }

  return Effect.forEach(filteredSlugs, (slug) => processSlug(slug, locale), {
    concurrency: "unbounded",
  }).pipe(Effect.map((items) => items.filter((item) => item !== undefined)));
}

/**
 * Parses and validates the `metadata` export from a dynamically imported module.
 *
 * @param module - Module namespace object returned by a dynamic import
 * @returns Effect that resolves to validated metadata or fails with parse details
 */
export function parseModuleMetadata(
  module: unknown
): Effect.Effect<ContentMetadata, MetadataParseError> {
  return Effect.gen(function* () {
    if (
      typeof module !== "object" ||
      module === null ||
      !("metadata" in module)
    ) {
      return yield* Effect.fail(
        new MetadataParseError({
          reason: "Module does not contain metadata property",
        })
      );
    }

    const metadata = module.metadata;

    return yield* Effect.try({
      try: () => ContentMetadataSchema.parse(metadata),
      catch: (error: unknown) =>
        new MetadataParseError({
          reason: error instanceof Error ? error.message : String(error),
        }),
    });
  });
}

/**
 * Parses a raw references array with schema validation.
 *
 * @param rawReferences - Untrusted references payload from a module export
 * @returns Effect that resolves to validated references
 */
export function parseReferences(
  rawReferences: unknown[]
): Effect.Effect<Reference[], Error> {
  return Effect.try({
    try: () => ReferenceSchema.array().parse(rawReferences),
    catch: (error: unknown) =>
      new Error(
        `Failed to parse references: ${error instanceof Error ? error.message : String(error)}`
      ),
  });
}

/**
 * Safely extracts the raw `references` export from a module namespace.
 *
 * @param module - Module namespace returned by dynamic import
 * @returns Raw references array or an empty array when unavailable
 */
export function extractReferences(module: unknown): unknown[] {
  if (typeof module === "object" && module !== null && "references" in module) {
    const refs = module.references;
    if (Array.isArray(refs)) {
      return refs;
    }
  }
  return [];
}

/**
 * Retrieves references for a content file from its ref.ts module.
 * References are optional; returns empty array if not found.
 *
 * @param filePath - Relative path without locale or extension
 * @returns Effect that produces array of reference objects, or empty array if not found
 *
 * @example
 * ```ts
 * const refs = await Effect.runPromise(getReferences("articles/politics/my-article"));
 * refs.forEach(ref => console.log(ref.title, ref.url));
 * ```
 */
export function getReferences(filePath: string): Effect.Effect<Reference[]> {
  return Effect.gen(function* () {
    const cleanPath = cleanSlug(filePath);
    const refModule = yield* Effect.tryPromise({
      try: () => importReferencesModule(cleanPath),
      catch: () => new Error("Failed to load references"),
    });

    const rawReferences = extractReferences(refModule);
    const parsedReferences = yield* parseReferences(rawReferences);

    return parsedReferences;
  }).pipe(Effect.catchAll(() => Effect.succeed([])));
}
