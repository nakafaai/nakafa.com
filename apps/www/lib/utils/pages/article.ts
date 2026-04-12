import { getSlugPath } from "@repo/contents/_lib/articles/slug";
import { getContentMetadataWithRaw } from "@repo/contents/_lib/metadata";
import type {
  FileReadError,
  GitHubFetchError,
  InvalidPathError,
  MetadataParseError,
  ModuleLoadError,
} from "@repo/contents/_shared/error";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import type { ContentWithMDX } from "@repo/contents/_types/content";
import { Effect } from "effect";
import type { Locale } from "next-intl";

export interface FetchArticleContextInput {
  /** The article category */
  category: ArticleCategory;
  /** The locale for localized content */
  locale: Locale;
  /** The article slug */
  slug: string;
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
    content: Effect.orElse(getContentMetadataWithRaw(locale, FilePath), () =>
      Effect.succeed(null)
    ),
    FilePath: Effect.succeed(FilePath),
  });
}
