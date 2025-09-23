import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { GradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import * as z from "zod";

export const AskSubjectSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  category: SubjectCategorySchema,
  grade: GradeSchema,
  material: MaterialSchema,
});
export type AskSubject = z.infer<typeof AskSubjectSchema>;

export const AskArticleSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  category: ArticleCategorySchema,
});
export type AskArticle = z.infer<typeof AskArticleSchema>;
