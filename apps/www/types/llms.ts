import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { GradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import { routing } from "@repo/internationalization/src/routing";
import * as z from "zod";

export const ArticleSchema = z.object({
  category: ArticleCategorySchema,
  slug: z.array(z.string()),
});
export type Article = z.infer<typeof ArticleSchema>;

export const SubjectSchema = z.object({
  category: SubjectCategorySchema,
  grade: GradeSchema,
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
