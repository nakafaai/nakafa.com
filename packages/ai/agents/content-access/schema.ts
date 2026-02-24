import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { GradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import * as z from "zod";

/**
 * Input schema for getting articles from Nakafa platform
 */
export const getArticlesInputSchema = z
  .object({
    locale: z.enum(["en", "id"]).describe("The locale of article to get."),
    category: ArticleCategorySchema.describe(
      "The category of the article to get."
    ),
  })
  .describe(
    "Get articles from Nakafa platform - includes scientific journals, research papers, internet articles, news, analysis, politics, and general publications. Use this for research questions, current events, scientific studies, news analysis, and academic research topics."
  );
export type GetArticlesInput = z.input<typeof getArticlesInputSchema>;

/**
 * Output schema for getArticles tool
 */
export const getArticlesOutputSchema = z
  .object({
    baseUrl: z.string().describe("The base url of articles."),
    articles: z.array(
      z.object({
        title: z.string().describe("The title of article."),
        url: z.string().describe("The url of article."),
        slug: z.string().describe("The slug of article."),
        locale: z.string().describe("The locale of article."),
      })
    ),
  })
  .describe(
    "The output schema for getArticles tool. The articles are from Nakafa platform."
  );
export type GetArticlesOutput = z.output<typeof getArticlesOutputSchema>;

/**
 * Input schema for getting subjects from Nakafa platform
 */
export const getSubjectsInputSchema = z
  .object({
    locale: z.enum(["en", "id"]).describe("The locale of subject to get."),
    category: SubjectCategorySchema.describe(
      "The category of the subject to get."
    ),
    grade: GradeSchema.describe("The grade of subject to get."),
    material: MaterialSchema.describe("The material of subject to get."),
  })
  .describe(
    "Get educational subjects from Nakafa platform - structured learning materials and curricula from K-12 through university level. Use this for study questions, homework help, learning concepts, educational content, and curriculum-based topics."
  );
export type GetSubjectsInput = z.input<typeof getSubjectsInputSchema>;

/**
 * Output schema for getSubjects tool
 */
export const getSubjectsOutputSchema = z
  .object({
    baseUrl: z.string().describe("The base url of subjects."),
    subjects: z.array(
      z.object({
        title: z.string().describe("The title of subject."),
        url: z.string().describe("The url of subject."),
        slug: z.string().describe("The slug of subject."),
        locale: z.string().describe("The locale of subject."),
      })
    ),
  })
  .describe(
    "The output schema for getSubjects tool. The subjects are K-12 to university level."
  );
export type GetSubjectsOutput = z.output<typeof getSubjectsOutputSchema>;

/**
 * Input schema for getting full content from Nakafa platform
 */
export const getContentInputSchema = z
  .object({
    locale: z.enum(["en", "id"]).describe("The locale of content to get."),
    slug: z
      .string()
      .describe(
        "The slug of content to get - MUST be a verified slug returned from getSubjects or getArticles responses. Use slug exactly as returned. Always start with slash (/). DO NOT include locale in the slug. NEVER use unverified slugs."
      ),
  })
  .describe(
    "Get the full content from Nakafa platform. CRITICAL: ONLY use this with slugs that were returned from getSubjects or getArticles responses. NEVER use with guessed, assumed, or unverified slugs."
  );
export type GetContentInput = z.input<typeof getContentInputSchema>;

/**
 * Output schema for getContent tool
 */
export const getContentOutputSchema = z
  .object({
    url: z.string().describe("The url of content from Nakafa."),
    content: z.string().describe("The content of page."),
  })
  .describe(
    "The output schema for getContent tool. The content is full content of page."
  );
export type GetContentOutput = z.output<typeof getContentOutputSchema>;
