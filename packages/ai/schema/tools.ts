import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { GradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import * as z from "zod";

export const getContentsInputSchema = z
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
          .nullish()
          .describe("The category of the content to get."),
        grade: GradeSchema.nullish().describe(
          "The grade of the content to get. Only for when type is 'subject'."
        ),
        material: MaterialSchema.nullish().describe(
          "The material of the content to get. Only for when type is 'subject'."
        ),
      })
      .describe(
        "Filter by content type, category, grade, and material. Type 'articles' only have category, type 'subject' have category, grade, and material."
      ),
  })
  .describe("The input schema for the getContents tool.");
export type GetContentsInput = z.infer<typeof getContentsInputSchema>;

export const getContentsOutputSchema = z
  .object({
    contents: z
      .array(
        z.object({
          title: z.string().describe("The title of the content."),
          slug: z.string().describe("The slug of the content."),
          url: z.string().describe("The url of the content from Nakafa."),
          locale: z.string().describe("The locale of the content."),
        })
      )
      .describe("The list of contents available in Nakafa."),
  })
  .describe("The output schema for the getContents tool.");
export type GetContentsOutput = z.infer<typeof getContentsOutputSchema>;

export const getContentInputSchema = z
  .object({
    locale: z.enum(["en", "id"]).describe("The locale of the content to get."),
    slug: z.string().describe(
      `The slug of the content to get. Use slug as it is, do not change anything. Always start with slash (/). DO NOT include locale in the slug.
        The slug also can be found in the 'slug' field of the getContents tool which is to get the list of contents available in Nakafa.`
    ),
  })
  .describe("The input schema for the getContent tool.");
export type GetContentInput = z.infer<typeof getContentInputSchema>;

export const getContentOutputSchema = z
  .object({
    url: z.string().describe("The url of the content from Nakafa."),
    content: z.string().describe("The content of the page."),
  })
  .describe("The output schema for the getContent tool.");
export type GetContentOutput = z.infer<typeof getContentOutputSchema>;

export const mathEvalInputSchema = z
  .object({
    expression: z
      .string()
      .describe(
        "Valid math expression to evaluate. It will use math.js to evaluate the expression."
      ),
  })
  .describe("The input schema for the mathEval tool.");
export type MathEvalInput = z.infer<typeof mathEvalInputSchema>;

export const mathEvalOutputSchema = z
  .object({
    original: z.object({
      expression: z.string().describe("The original expression."),
      latex: z.string().describe("The original expression in LaTeX."),
    }),
    result: z.object({
      expression: z.string().describe("The simplified expression."),
      latex: z.string().describe("The simplified expression in LaTeX."),
      value: z.string().describe("The evaluated value."),
    }),
  })
  .describe("The output schema for the mathEval tool.");
export type MathEvalOutput = z.infer<typeof mathEvalOutputSchema>;
