import { getSlugPath } from "@repo/contents/_lib/articles/slug";
import { getContent, getReferences } from "@repo/contents/_lib/content";
import {
  type FileReadError,
  type GitHubFetchError,
  InvalidPathError,
  type MetadataParseError,
  type ModuleLoadError,
} from "@repo/contents/_shared/error";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import type { ContentWithMDX, Reference } from "@repo/contents/_types/content";
import { Effect } from "effect";
import type { Locale } from "next-intl";

/**
 * Input parameters for fetching article context.
 */
export interface FetchArticleContextInput {
  /** The article category */
  category: ArticleCategory;
  /** The locale for localized content */
  locale: Locale;
  /** The article slug */
  slug: string;
}

/**
 * Output data containing fetched article context.
 */
export interface FetchArticleContextOutput {
  /** The content data with MDX component */
  content: ContentWithMDX;
  /** The list of references for the article */
  references: Reference[];
}

/**
 * Output data containing fetched article metadata context.
 */
export interface FetchArticleMetadataContextOutput {
  /** The content data with MDX component, or null if not found */
  content: ContentWithMDX | null;
  /** The full file path to the content file */
  FilePath: ReturnType<typeof getSlugPath>;
}

/**
 * Fetches the article context including content data and references.
 * Returns an error if the content is not found.
 *
 * @param input - The input parameters for fetching article context
 * @param input.locale - The locale for localized content
 * @param input.category - The article category
 * @param input.slug - The article slug
 * @returns An Effect that resolves to the article context or fails with an Error
 */
export function fetchArticleContext({
  locale,
  category,
  slug,
}: FetchArticleContextInput): Effect.Effect<
  FetchArticleContextOutput,
  | InvalidPathError
  | FileReadError
  | GitHubFetchError
  | MetadataParseError
  | ModuleLoadError
> {
  const FilePath = getSlugPath(category, slug);

  return Effect.gen(function* () {
    const content = yield* getContent(locale, FilePath);

    if (content === null) {
      return yield* Effect.fail(
        new InvalidPathError({
          path: FilePath,
          reason: "Article content not found",
        })
      );
    }

    const references = yield* getReferences(FilePath);

    return { content, references };
  });
}

/**
 * Fetches the article metadata context for generating page metadata.
 * Returns null for content if not found, allowing for graceful handling.
 *
 * @param input - The input parameters for fetching article metadata context
 * @param input.locale - The locale for localized content
 * @param input.category - The article category
 * @param input.slug - The article slug
 * @returns An Effect that resolves to the article metadata context
 */
export function fetchArticleMetadataContext({
  locale,
  category,
  slug,
}: FetchArticleContextInput): Effect.Effect<
  FetchArticleMetadataContextOutput,
  | InvalidPathError
  | FileReadError
  | GitHubFetchError
  | MetadataParseError
  | ModuleLoadError
> {
  const FilePath = getSlugPath(category, slug);

  return Effect.all({
    content: Effect.orElse(getContent(locale, FilePath), () =>
      Effect.succeed(null)
    ),
    FilePath: Effect.succeed(FilePath),
  });
}
