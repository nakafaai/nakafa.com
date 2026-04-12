import { getContentMetadataWithRaw } from "@repo/contents/_lib/metadata";
import { getSlugPath } from "@repo/contents/_lib/subject/slug";
import type { ContentWithMDX } from "@repo/contents/_types/content";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";
import { Effect } from "effect";
import type { Locale } from "next-intl";

/**
 * Input parameters for fetching subject content context.
 */
interface GetContentContextInput {
  /** The subject category */
  category: SubjectCategory;
  /** The grade level */
  grade: Grade;
  /** The locale for localized content */
  locale: Locale;
  /** The material type */
  material: Material;
  /** The slug path segments for the specific content */
  slug: string[];
}

/**
 * Output data containing fetched subject metadata context.
 */
interface GetContentMetadataContextOutput {
  /** The content data with MDX component, or null if not found */
  content: ContentWithMDX | null;
  /** The full file path to the content file */
  FilePath: ReturnType<typeof getSlugPath>;
}

/**
 * Fetches the subject metadata context for generating page metadata.
 * Returns null for content if not found, allowing for graceful handling.
 *
 * @param input - The input parameters for fetching subject metadata context
 * @param input.locale - The locale for localized content
 * @param input.category - The subject category
 * @param input.grade - The grade level
 * @param input.material - The material type
 * @param input.slug - The slug path segments for the specific content
 * @returns An Effect that resolves to the subject metadata context
 */
export function getContentMetadataContext({
  locale,
  category,
  grade,
  material,
  slug,
}: GetContentContextInput): Effect.Effect<
  GetContentMetadataContextOutput,
  Error
> {
  const FilePath = getSlugPath(category, grade, material, slug);

  return Effect.all({
    content: Effect.orElse(getContentMetadataWithRaw(locale, FilePath), () =>
      Effect.succeed(null)
    ),
    FilePath: Effect.succeed(FilePath),
  });
}
