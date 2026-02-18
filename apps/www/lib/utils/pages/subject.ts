import { getContent } from "@repo/contents/_lib/content";
import {
  getMaterialPath,
  getMaterials,
} from "@repo/contents/_lib/subject/material";
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
 * Output data containing fetched subject content context.
 */
interface GetContentContextOutput {
  /** The content data with MDX component (guaranteed to be defined) */
  content: ContentWithMDX;
  /** The full file path to the content file */
  FilePath: ReturnType<typeof getSlugPath>;
  /** The file path to the material directory */
  materialPath: string;
  /** All available materials for the given category/grade/material */
  materials: Awaited<ReturnType<typeof getMaterials>>;
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
 * Fetches the subject content context including content data, materials, and paths.
 *
 * @param input - The input parameters for fetching subject content context
 * @param input.locale - The locale for localized content
 * @param input.category - The subject category
 * @param input.grade - The grade level
 * @param input.material - The material type
 * @param input.slug - The slug path segments for the specific content
 * @returns An Effect that resolves to the subject content context or fails with an Error
 */
export function getContentContext({
  locale,
  category,
  grade,
  material,
  slug,
}: GetContentContextInput): Effect.Effect<GetContentContextOutput, Error> {
  return Effect.gen(function* () {
    const materialPath = getMaterialPath(category, grade, material);
    const FilePath = getSlugPath(category, grade, material, slug);

    const [content, materials] = yield* Effect.all([
      Effect.orElse(getContent(locale, FilePath), () => Effect.succeed(null)),
      Effect.tryPromise({
        try: () => getMaterials(materialPath, locale),
        catch: () => new Error("Failed to fetch materials"),
      }),
    ]);

    if (content === null) {
      return yield* Effect.fail(new Error("Subject content not found"));
    }

    return {
      content,
      materials,
      materialPath,
      FilePath,
    };
  });
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
    content: Effect.orElse(getContent(locale, FilePath), () =>
      Effect.succeed(null)
    ),
    FilePath: Effect.succeed(FilePath),
  });
}
