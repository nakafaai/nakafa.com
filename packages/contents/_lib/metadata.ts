import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contentsDir = path.dirname(__dirname);
const METADATA_REGEX = /export const metadata\s*=\s*({[\s\S]*?});/;

export interface ContentMetadataListItem {
  locale: Locale;
  metadata: ContentMetadata;
  slug: string;
  url: string;
}

export interface ContentMetadataWithRaw {
  metadata: ContentMetadata;
  raw: string;
}

/**
 * Extract metadata from raw MDX content.
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
 * Read metadata for a single content file without loading its MDX component.
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
 * Read raw content and metadata without loading the MDX component module.
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
 * List content metadata and URLs without loading MDX components.
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
          return undefined;
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
