import { z } from "zod/v4";

export const ArticleCategorySchema = z.enum(["politics"]);
export type ArticleCategory = z.infer<typeof ArticleCategorySchema>;
