import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { extractMetadata } from "@repo/contents/_lib/metadata";
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
  type ContentRoot,
  type ContentWithMDX,
  type Reference,
  ReferenceSchema,
} from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option } from "effect";
import ky from "ky";
import { type ComponentType, createElement } from "react";

const contentsDir = resolveContentsDir(import.meta.url);

interface ScopedContentModule {
  default: ComponentType;
  metadata?: unknown;
}

interface ScopedReferencesModule {
  references?: unknown;
}

interface ScopedContentTarget {
  cleanPath: string;
  contentPath: string;
  relativePath: string;
}

type ScopedContentImporter = (
  relativePath: string,
  locale: Locale
) => Promise<ScopedContentModule>;

type ScopedReferencesImporter = (
  relativePath: string
) => Promise<ScopedReferencesModule>;

/**
 * Validates a content-relative path against the contents root to block path
 * traversal before any filesystem read happens.
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
 * Reads a raw content file from disk and falls back to the canonical GitHub
 * source when the local file is unavailable.
 */
export function getRawContent(
  filePath: string
): Effect.Effect<string, InvalidPathError | FileReadError | GitHubFetchError> {
  const cleanPath = cleanSlug(filePath);

  return validatePath(filePath, contentsDir).pipe(
    Effect.flatMap((fullPath) => {
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
    })
  );
}

/**
 * Normalizes one content path for a specific root and locale so root-scoped
 * loaders can share the same path validation rules.
 */
function getScopedContentTarget(
  root: ContentRoot,
  filePath: string,
  locale: Locale
): Effect.Effect<ScopedContentTarget, InvalidPathError> {
  const cleanPath = cleanSlug(filePath);
  const rootPrefix = `${root}/`;

  if (!cleanPath.startsWith(rootPrefix)) {
    return Effect.fail(
      new InvalidPathError({
        path: filePath,
        reason: `Path does not belong to the ${root} content root`,
      })
    );
  }

  const relativePath = cleanPath.slice(rootPrefix.length);

  return Effect.succeed({
    cleanPath,
    contentPath: `${cleanPath}/${locale}.mdx`,
    relativePath,
  });
}

/**
 * Validates the `metadata` export from one dynamically imported MDX module.
 *
 * @param module - Module namespace object returned by dynamic import
 * @param modulePath - Optional module path used to enrich parse errors
 */
export function parseModuleMetadata(
  module: unknown,
  modulePath = ""
): Effect.Effect<ContentMetadata, MetadataParseError> {
  return Effect.gen(function* () {
    if (
      typeof module !== "object" ||
      module === null ||
      !("metadata" in module)
    ) {
      return yield* Effect.fail(
        new MetadataParseError({
          path: modulePath,
          reason: "Module does not contain metadata property",
        })
      );
    }

    return yield* Effect.try({
      try: () => ContentMetadataSchema.parse(module.metadata),
      catch: (error: unknown) =>
        new MetadataParseError({
          path: modulePath,
          reason: String(error),
        }),
    });
  });
}

/**
 * Pulls the raw `references` export from a module namespace and returns an empty
 * array when the export is absent or not an array.
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
 * Validates one raw references payload with the shared references schema.
 */
export function parseReferences(
  rawReferences: unknown[]
): Effect.Effect<Reference[], Error> {
  return Effect.try({
    try: () => ReferenceSchema.array().parse(rawReferences),
    catch: (error: unknown) =>
      new Error(`Failed to parse references: ${String(error)}`),
  });
}

/**
 * Loads content from one fixed top-level root so Turbopack only sees that root's
 * dynamic import context instead of the shared catch-all content loader.
 */
export function getScopedContent(
  root: ContentRoot,
  importContentModule: ScopedContentImporter,
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

  return Effect.gen(function* () {
    const target = yield* getScopedContentTarget(root, filePath, locale);

    if (includeMDX) {
      const [raw, contentModule] = yield* Effect.all(
        [
          getRawContent(target.contentPath),
          Effect.tryPromise({
            try: () => importContentModule(target.relativePath, locale),
            catch: (error: unknown) =>
              new ModuleLoadError({
                path: `@repo/contents/${target.contentPath}`,
                cause: error,
              }),
          }),
        ],
        { concurrency: "unbounded" }
      );

      const metadata = yield* parseModuleMetadata(
        contentModule,
        `@repo/contents/${target.contentPath}`
      );

      return {
        metadata,
        default: createElement(contentModule.default),
        raw,
      };
    }

    const raw = yield* getRawContent(target.contentPath);
    const metadata = extractMetadata(raw);

    if (Option.isNone(metadata)) {
      return yield* Effect.fail(
        new MetadataParseError({
          path: target.contentPath,
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
 * Loads all content entries under one fixed root and maps them into the shared
 * list response shape used by API/content listing callers.
 */
export function getScopedContents(
  root: ContentRoot,
  importContentModule: ScopedContentImporter,
  options: {
    basePath?: string;
    includeMDX?: boolean;
    locale?: Locale;
  } = {}
): Effect.Effect<ContentListWithMDX[], never, never> {
  const { includeMDX = true, locale = "en", basePath = root } = options;

  const slugs = getMDXSlugsForLocale(locale).filter((slug) =>
    slug.startsWith(basePath)
  );

  /**
   * Loads one scoped slug into the normalized list response shape.
   */
  function processSlug(slug: string, contentLocale: Locale) {
    return Effect.gen(function* () {
      const content = yield* Effect.either(
        getScopedContent(root, importContentModule, contentLocale, slug, {
          includeMDX,
        })
      );

      if (content._tag === "Left") {
        return undefined;
      }

      const url = new URL(`/${contentLocale}/${slug}`, "https://nakafa.com");

      const result: ContentListWithMDX = {
        metadata: content.right.metadata,
        raw: content.right.raw,
        url: url.toString(),
        slug,
        locale: contentLocale,
      };

      return result;
    });
  }

  return Effect.forEach(slugs, (slug) => processSlug(slug, locale), {
    concurrency: "unbounded",
  }).pipe(Effect.map((items) => items.filter((item) => item !== undefined)));
}

/**
 * Loads references from one fixed top-level root and gracefully falls back to an
 * empty list when the references module is missing or invalid.
 */
export function getScopedReferences(
  root: Extract<ContentRoot, "articles">,
  importReferencesModule: ScopedReferencesImporter,
  filePath: string
): Effect.Effect<Reference[]> {
  return Effect.gen(function* () {
    const target = yield* getScopedContentTarget(root, filePath, "en");

    const referencesModule = yield* Effect.tryPromise({
      try: () => importReferencesModule(target.relativePath),
      catch: () => new Error("Failed to load references"),
    });

    return yield* parseReferences(extractReferences(referencesModule));
  }).pipe(Effect.catchAll(() => Effect.succeed([])));
}
