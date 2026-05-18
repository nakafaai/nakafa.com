import { Schema } from "effect";

export const ARTICLE_CATEGORIES = ["politics"] as const;

export const ArticleCategorySchema = Schema.Literal(...ARTICLE_CATEGORIES);
export type ArticleCategory = Schema.Schema.Type<typeof ArticleCategorySchema>;
