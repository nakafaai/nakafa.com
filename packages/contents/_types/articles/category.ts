import { ARTICLE_CATEGORIES } from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

export const ArticleCategorySchema = Schema.Literal(...ARTICLE_CATEGORIES);
