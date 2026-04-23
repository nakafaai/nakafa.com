import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import {
  FileReadError,
  InvalidPathError,
  MetadataParseError,
} from "@repo/contents/_shared/error";
import type { Locale } from "@repo/contents/_types/content";
import {
  type ContentMetadata,
  ContentMetadataSchema,
} from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option } from "effect";

const contentsDir = resolveContentsDir(import.meta.url);
const METADATA_REGEX = /export const metadata\s*=\s*({[\s\S]*?});/;

/**
 * Metadata summary for a content entry without loading its MDX component.
 */
export interface ContentMetadataListItem {
  locale: Locale;
  metadata: ContentMetadata;
  slug: string;
  url: string;
}

/**
 * Parsed metadata bundled together with the original raw MDX source.
 */
export interface ContentMetadataWithRaw {
  metadata: ContentMetadata;
  raw: string;
}

/**
 * Extracts and validates the `metadata` export from raw MDX source.
 *
 * @param rawContent - Raw MDX file contents including the metadata export
 * @returns Parsed metadata when present and valid, otherwise `Option.none()`
 */
export function extractMetadata(
  rawContent: string
): Option.Option<ContentMetadata> {
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
 * Reads metadata for one localized content file without importing the MDX module.
 *
 * @param filePath - Content slug relative to `packages/contents`
 * @param locale - Locale of the MDX file to read
 * @returns Effect that resolves to validated metadata from the target file
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
 * Reads raw MDX source together with its parsed metadata.
 *
 * @param locale - Locale of the MDX file to read
 * @param filePath - Content slug relative to `packages/contents`
 * @returns Effect that resolves to metadata plus the original raw MDX text
 */
export function getContentMetadataWithRaw(
  locale: Locale,
  filePath: string
): Effect.Effect<
  ContentMetadataWithRaw,
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
    const raw = yield* Effect.tryPromise({
      try: () => fsPromises.readFile(fullPath, "utf8"),
      catch: (error: unknown) =>
        new FileReadError({
          path: fullPath,
          cause: error,
        }),
    });

    const metadata = extractMetadata(raw);
    if (Option.isNone(metadata)) {
      return yield* Effect.fail(
        new MetadataParseError({
          path: fullPath,
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
 * Lists metadata and canonical URLs for matching content entries.
 *
 * @param options - Optional locale and base-path filters
 * @returns Effect that resolves to metadata summaries for matching content
 */
export function getContentsMetadata(
  options: { basePath?: string; locale?: Locale } = {}
): Effect.Effect<ContentMetadataListItem[], never, never> {
  const { locale = "en", basePath = "" } = options;
  const slugs = getMDXSlugsForLocale(locale);
  const filteredSlugs = basePath
    ? slugs.filter((slug) => slug.startsWith(basePath))
    : slugs;

  return Effect.forEach(
    filteredSlugs,
    (slug) =>
      Effect.gen(function* () {
        const metadata = yield* Effect.either(getContentMetadata(slug, locale));

        if (metadata._tag === "Left") {
          return;
        }

        const url = new URL(`/${locale}/${slug}`, "https://nakafa.com");

        return {
          locale,
          metadata: metadata.right,
          slug,
          url: url.toString(),
        } satisfies ContentMetadataListItem;
      }),
    { concurrency: "unbounded" }
  ).pipe(Effect.map((items) => items.filter((item) => item !== undefined)));
}
