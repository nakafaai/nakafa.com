import { routing } from "@/i18n/routing";
import { z } from "zod/v4";
import { ArticleCategorySchema } from "./articles/category";
import { SubjectCategorySchema } from "./subject/category";
import { gradeSchema } from "./subject/grade";
import { MaterialSchema } from "./subject/material";

export const ArticleSchema = z.object({
  category: ArticleCategorySchema,
  slug: z.array(z.string()),
});
export type Article = z.infer<typeof ArticleSchema>;

export const SubjectSchema = z.object({
  category: SubjectCategorySchema,
  grade: gradeSchema,
  material: MaterialSchema,
  slug: z.array(z.string()),
});
export type Subject = z.infer<typeof SubjectSchema>;

export const ContentTaskSchema = z.object({
  locale: z.enum(routing.locales),
  filePath: z.string(),
  section: z.string(),
});
export type ContentTask = z.infer<typeof ContentTaskSchema>;
