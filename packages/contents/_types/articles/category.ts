import type { Locale } from "@repo/contents/_types/content";
import type { ArticleCategory } from "@repo/contents/_types/taxonomy";
import { ARTICLE_CATEGORIES } from "@repo/contents/_types/taxonomy";
import { fieldsForEveryLocale } from "@repo/utilities/locales";
import { Schema } from "effect";

export const ArticleCategorySchema = Schema.Literal(...ARTICLE_CATEGORIES);

const ArticleCategoryTitleSchema = Schema.Struct(
  fieldsForEveryLocale(Schema.String)
);
const ArticleCategoryTitlesSchema = Schema.Record({
  key: ArticleCategorySchema,
  value: ArticleCategoryTitleSchema,
});

const articleCategoryTitles = Schema.decodeUnknownSync(
  ArticleCategoryTitlesSchema
)({
  politics: {
    en: "Politics",
    id: "Politik",
  },
});

/** Reads the source-owned localized title for an article category. */
export function readArticleCategoryTitle(
  category: ArticleCategory,
  locale: Locale
) {
  return articleCategoryTitles[category][locale];
}
