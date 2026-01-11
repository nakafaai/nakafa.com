import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import {
  FileReadError,
  GitHubFetchError,
  InvalidPathError,
  MetadataParseError,
  ModuleLoadError,
} from "@repo/contents/_shared/error";
import {
  type ContentListWithMDX,
  type ContentMetadata,
  ContentMetadataSchema,
  type ContentWithMDX,
  type Reference,
  ReferenceSchema,
} from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Either, Option } from "effect";
import ky from "ky";
import type { Locale } from "next-intl";
import { createElement } from "react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contentsDir = path.dirname(__dirname);
const METADATA_REGEX = /export const metadata\s*=\s*({[\s\S]*?});/;

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

export interface ContentOptions {
  includeMDX?: boolean;
  locale?: Locale;
  basePath?: string;
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
      const raw = yield* getRawContent(contentPath);

      const contentModule = yield* Effect.tryPromise({
        try: () => import(`@repo/contents/${cleanPath}/${locale}.mdx`),
        catch: (error: unknown) =>
          new ModuleLoadError({
            path: `@repo/contents/${cleanPath}/${locale}.mdx`,
            cause: error,
          }),
      });

      const parsedMetadata = yield* parseModuleMetadata(contentModule).pipe(
        Effect.mapError((error) => ({
          ...error,
          path: `@repo/contents/${cleanPath}/${locale}.mdx`,
        }))
      );

      return {
        metadata: parsedMetadata,
        default: createElement(contentModule.default),
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
  const {
    includeMDX = true,
    locale = "en",
    basePath = "",
  }: ContentOptions = options;

  const slugs = getMDXSlugsForLocale(locale);

  const filteredSlugs = basePath
    ? slugs.filter((slug) => slug.startsWith(basePath))
    : slugs;

  return Effect.forEach(
    filteredSlugs,
    (slug) =>
      Effect.gen(function* () {
        const content = yield* Effect.either(
          getContent(locale, slug, { includeMDX })
        );

        if (Either.isLeft(content)) {
          return undefined;
        }

        const url = new URL(`/${locale}/${slug}`, "https://nakafa.com");

        return {
          metadata: content.right.metadata,
          raw: content.right.raw,
          url: url.toString(),
          slug,
          locale,
        };
      }),
    { concurrency: "unbounded" }
  ).pipe(Effect.map((items) => items.filter((item) => item !== undefined)));
}

/**
 * Extracts metadata from a content file without loading the MDX component.
 * Useful for preview or list views where full content isn't needed.
 *
 * @param filePath - Relative path without locale or extension
 * @param locale - Target locale
 * @returns Effect that resolves to parsed metadata object, or fails with InvalidPathError, FileReadError, or MetadataParseError
 *
 * @example
 * ```ts
 * const metadata = Effect.runPromise(getContentMetadata("articles/politics/my-article", "en"));
 * console.log(metadata.title, metadata.date);
 * ```
 */
export function getContentMetadata(
  filePath: string,
  locale: Locale
): Effect.Effect<
  ContentMetadata,
  InvalidPathError | FileReadError | MetadataParseError
> {
  const cleanPath = cleanSlug(filePath);
  const fullPath = path.join(contentsDir, `${cleanPath}/${locale}.mdx`);

  if (!fullPath.startsWith(contentsDir)) {
    return Effect.fail(
      new InvalidPathError({
        path: filePath,
        reason: "Path traversal detected",
      })
    );
  }

  return Effect.gen(function* () {
    const rawContent = yield* Effect.tryPromise({
      try: () => fsPromises.readFile(fullPath, "utf8"),
      catch: (error: unknown) =>
        new FileReadError({
          path: fullPath,
          cause: error,
        }),
    });

    const metadata = extractMetadata(rawContent);
    if (Option.isNone(metadata)) {
      return yield* Effect.fail(
        new MetadataParseError({
          path: fullPath,
          reason: "No metadata found",
        })
      );
    }

    return metadata.value;
  });
}

/**
 * Extracts and parses metadata from raw MDX content using regex.
 * Safely evaluates the metadata export statement.
 *
 * @param rawContent - Raw MDX file content
 * @returns Option containing parsed metadata object, or None if no metadata found or parsing fails
 */
function extractMetadata(rawContent: string): Option.Option<ContentMetadata> {
  try {
    const metadataMatch = rawContent.match(METADATA_REGEX);

    if (!metadataMatch) {
      return Option.none();
    }

    const metadataObject = new Function(`return ${metadataMatch[1]}`)();
    return Option.fromNullable(ContentMetadataSchema.parse(metadataObject));
  } catch {
    return Option.none();
  }
}

/**
 * Parses metadata from a loaded module using Zod schema.
 * Pure function - doesn't require path for error context.
 *
 * @param module - The module object to parse metadata from
 * @returns Effect that resolves to parsed metadata, or fails with MetadataParseError
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
 * Parses raw references using Zod schema for type safety.
 *
 * @param rawReferences - The raw references array to parse
 * @returns Effect that resolves to a parsed array of Reference objects
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
 * Safely extracts references from an unknown module object.
 *
 * This function handles the unsafe `any` type from dynamic imports by validating
 * that the module has a `references` property that is an array.
 *
 * @param module - The dynamically imported module object
 * @returns An array of references (may be empty)
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
    const refPath = `${cleanPath}/ref`;
    const refModule = yield* Effect.tryPromise({
      try: () => import(`@repo/contents/${refPath}.ts`),
      catch: () => new Error("Failed to load references"),
    });

    const rawReferences = extractReferences(refModule);
    const parsedReferences = yield* parseReferences(rawReferences);

    return parsedReferences;
  }).pipe(Effect.catchAll(() => Effect.succeed([])));
}
