import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { GradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import { z } from "zod";

export const GetContentsSchema = z.object({
  locale: z
    .enum(["en", "id"])
    .default("en")
    .describe(
      "Language locale for content retrieval. 'en' for English, 'id' for Indonesian (Bahasa Indonesia)."
    ),
  filters: z
    .object({
      type: z
        .enum(["articles", "subject"])
        .default("subject")
        .describe(
          "The type of the content to get. 'articles' for articles and 'subject' for subjects."
        ),
      category: z
        .union([ArticleCategorySchema, SubjectCategorySchema])
        .optional()
        .describe("The category of the content to get."),
      grade: GradeSchema.optional().describe(
        "The grade of the content to get. Category must be specified if grade is specified. Only for subjects."
      ),
      material: MaterialSchema.optional().describe(
        "The material of the content to get. Category and grade must be specified if material is specified. Only for subjects."
      ),
    })
    .describe(
      "Filter by content type, category, grade, and material. articles only have category, subjects have category, grade, and material."
    ),
});
export type GetContentsParams = z.infer<typeof GetContentsSchema>;

export const getContentSchema = z.object({
  slug: z
    .string()
    .describe(
      "The slug of the content to get. The slug can be found in the 'slug' field of the 'get_contents' tool."
    ),
});
