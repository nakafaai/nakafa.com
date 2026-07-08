import { dirname } from "node:path";
import {
  ARTICLE_PATH_REGEX,
  BACKSLASH_REGEX,
  MATERIAL_LESSON_PATH_REGEX,
} from "@repo/backend/scripts/lib/mdx-parser/constants";
import {
  MdxPathValidationError,
  validateArticleCategory,
  validateLocale,
  validateMaterial,
} from "@repo/backend/scripts/lib/mdx-parser/validators";
import { Effect } from "effect";

/** Parses an article MDX path into its sync identifiers. */
export const parseArticlePath = Effect.fn("mdx.parseArticlePath")(function* (
  filePath: string
) {
  const normalized = filePath.replace(BACKSLASH_REGEX, "/");
  const match = normalized.match(ARTICLE_PATH_REGEX);

  if (!match) {
    return yield* Effect.fail(
      new MdxPathValidationError({
        message: `Invalid article path: ${filePath}`,
      })
    );
  }

  const [, rawCategory, articleSlug, rawLocale] = match;
  const category = yield* validateArticleCategory(
    rawCategory.toLowerCase(),
    filePath
  );
  const locale = yield* validateLocale(rawLocale, filePath);

  return {
    type: "article",
    locale,
    category,
    articleSlug,
    slug: `articles/${category}/${articleSlug}`,
  };
});

/** Parses a curriculum lesson MDX path into its sync identifiers. */
export const parseMaterialLessonPath = Effect.fn("mdx.parseMaterialLessonPath")(
  function* (filePath: string) {
    const normalized = filePath.replace(BACKSLASH_REGEX, "/");
    const match = normalized.match(MATERIAL_LESSON_PATH_REGEX);

    if (!match) {
      return yield* Effect.fail(
        new MdxPathValidationError({
          message: `Invalid material lesson path: ${filePath}`,
        })
      );
    }

    const [, rawMaterial, topic, section, rawLocale] = match;
    const material = yield* validateMaterial(rawMaterial, filePath);
    const locale = yield* validateLocale(rawLocale, filePath);

    return {
      type: "material-lesson",
      locale,
      material,
      topic,
      section,
      slug: `material/lesson/${material}/${topic}/${section}`,
    };
  }
);

/** Returns the directory that contains one localized article MDX file. */
export const getArticleDir = (filePath: string) => dirname(filePath);
