import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { extractMetadata } from "@repo/contents/_lib/metadata";
import { importContentModule } from "@repo/contents/_lib/module";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import {
  getRawContent,
  parseModuleMetadata,
  validatePath,
} from "@repo/contents/_lib/scoped";
import {
  type FileReadError,
  type GitHubFetchError,
  type InvalidPathError,
  MetadataParseError,
  ModuleLoadError,
} from "@repo/contents/_shared/error";
import type {
  ContentListWithMDX,
  ContentWithMDX,
  Locale,
  RenderableContent,
} from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Either, Option } from "effect";

const contentsDir = resolveContentsDir(import.meta.url);

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

    const metadata = yield* parseModuleMetadata(contentModule, modulePath).pipe(
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
      default: contentModule.default,
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

  /**
   * Loads one cached slug into the normalized list response shape.
   */
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
