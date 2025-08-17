import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { GradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import * as z from "zod";

export const createTaskInputSchema = z
  .object({
    context: z
      .string()
      .describe(
        "The context of the task to create. The language of the context is the same as the language of the user."
      ),
  })
  .describe("The input schema for the createTask tool.");
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const createTaskOutputSchema = z
  .object({
    tasks: z.array(
      z.object({
        title: z
          .string()
          .describe(
            "The unique title of the items. Must be concise, simple, and to the point."
          ),
        items: z.array(
          z
            .object({
              title: z
                .string()
                .describe(
                  "The unique title of the task. Must be concise, simple, and to the point."
                ),
              task: z
                .string()
                .describe(
                  "The detailed task to perform. Detailed step by step and end to end explanation of the task to perform and always mention the tool to use."
                ),
            })
            .describe(
              "Unique and not redundant steps. But still detailed step by step guide. End to end guide."
            )
        ),
      })
    ),
  })
  .describe("The output schema for the createTask tool.");
export type CreateTaskOutput = z.infer<typeof createTaskOutputSchema>;

export const getArticlesInputSchema = z
  .object({
    locale: z.enum(["en", "id"]).describe("The locale of the article to get."),
    category: ArticleCategorySchema.describe(
      "The category of the article to get."
    ),
  })
  .describe("Get latest articles from Nakafa platform. Such as politics, etc.");
export type GetArticlesInput = z.infer<typeof getArticlesInputSchema>;

export const getArticlesOutputSchema = z
  .object({
    articles: z.array(
      z.object({
        title: z.string().describe("The title of the article."),
        slug: z.string().describe("The slug of the article."),
        locale: z.string().describe("The locale of the article."),
      })
    ),
  })
  .describe(
    "The output schema for the getArticles tool. The articles are from Nakafa platform."
  );
export type GetArticlesOutput = z.infer<typeof getArticlesOutputSchema>;

export const getSubjectsInputSchema = z
  .object({
    locale: z.enum(["en", "id"]).describe("The locale of the subject to get."),
    category: SubjectCategorySchema.describe(
      "The category of the subject to get."
    ),
    grade: GradeSchema.describe("The grade of the subject to get."),
    material: MaterialSchema.describe("The material of the subject to get."),
  })
  .describe(
    "Get educational subjects K-12 to university level from Nakafa platform."
  );
export type GetSubjectsInput = z.infer<typeof getSubjectsInputSchema>;

export const getSubjectsOutputSchema = z
  .object({
    subjects: z.array(
      z.object({
        title: z.string().describe("The title of the subject."),
        slug: z.string().describe("The slug of the subject."),
        locale: z.string().describe("The locale of the subject."),
      })
    ),
  })
  .describe(
    "The output schema for the getSubjects tool. The subjects are K-12 to university level."
  );
export type GetSubjectsOutput = z.infer<typeof getSubjectsOutputSchema>;

export const getContentInputSchema = z
  .object({
    locale: z.enum(["en", "id"]).describe("The locale of the content to get."),
    slug: z
      .string()
      .describe(
        "The slug of the content to get. Use slug as it is, do not change anything. Always start with slash (/). DO NOT include locale in the slug"
      ),
  })
  .describe("Get specific content from Nakafa platform.");
export type GetContentInput = z.infer<typeof getContentInputSchema>;

export const getContentOutputSchema = z
  .object({
    url: z.string().describe("The url of the content from Nakafa."),
    content: z.string().describe("The content of the page."),
  })
  .describe(
    "The output schema for the getContent tool. The content is the full content of the page."
  );
export type GetContentOutput = z.infer<typeof getContentOutputSchema>;

export const calculatorInputSchema = z
  .object({
    expression: z
      .string()
      .describe(
        "A valid mathematical expression for calculation. This tool functions as a calculator, using math.js to evaluate the expression."
      ),
  })
  .describe("The input schema for the calculator tool.");
export type CalculatorInput = z.infer<typeof calculatorInputSchema>;

export const calculatorOutputSchema = z
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
  .describe("The output schema for the calculator tool.");
export type CalculatorOutput = z.infer<typeof calculatorOutputSchema>;
