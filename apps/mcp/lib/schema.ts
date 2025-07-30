import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { GradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import * as z from "zod";

export const GetContentsSchema = z
  .object({
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
          .describe("The category of the content to get."),
        grade: GradeSchema.describe(
          "The grade of the content to get. Only for when type is 'subject'."
        ),
        material: MaterialSchema.describe(
          "The material of the content to get. Only for when type is 'subject'."
        ),
      })
      .describe(
        "Filter by content type, category, grade, and material. Type 'articles' only have category, type 'subject' have category, grade, and material."
      ),
  })
  .describe("The parameters to get the contents");
export type GetContentsParams = z.infer<typeof GetContentsSchema>;

export const GetContentSchema = z
  .object({
    slug: z
      .string()
      .describe(
        "The slug of the content to get. The slug can be found in the 'slug' field of the 'get_contents' tool."
      ),
  })
  .describe("The parameters to get the content");
