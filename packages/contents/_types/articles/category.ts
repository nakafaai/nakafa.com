import { z } from "zod";

export const ArticleCategorySchema = z.enum(["politics"]);
export type ArticleCategory = z.infer<typeof ArticleCategorySchema>;
