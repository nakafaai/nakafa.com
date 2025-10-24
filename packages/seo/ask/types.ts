import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { GradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import * as z from "zod";

const MetadataSchema = z.object({
  title: z.string(), // This is the question that the user will ask
  description: z.string(),
});

const BaseAskSchema = z.object({
  slug: z.string(), // slug version of the concise question
  locales: z.object({
    id: MetadataSchema,
    en: MetadataSchema,
  }),
});
export type BaseAsk = z.infer<typeof BaseAskSchema>;

const AskSubjectSchema = BaseAskSchema.extend({
  type: z.literal("subject"),
  category: SubjectCategorySchema,
  grade: GradeSchema,
  material: MaterialSchema,
});

const AskArticleSchema = BaseAskSchema.extend({
  type: z.literal("articles"),
  category: ArticleCategorySchema,
});

export const AskSchema = z.discriminatedUnion("type", [
  AskSubjectSchema,
  AskArticleSchema,
]);

export type Ask = z.infer<typeof AskSchema>;

export const isAskSubject = (
  ask: Ask,
): ask is z.infer<typeof AskSubjectSchema> => ask.type === "subject";

export const isAskArticle = (
  ask: Ask,
): ask is z.infer<typeof AskArticleSchema> => ask.type === "articles";
