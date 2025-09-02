import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { GradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import * as z from "zod";

export const getArticlesInputSchema = z
  .object({
    locale: z.enum(["en", "id"]).describe("The locale of the article to get."),
    category: ArticleCategorySchema.describe(
      "The category of the article to get."
    ),
  })
  .describe(
    "Get articles from Nakafa platform - includes scientific journals, research papers, internet articles, news, analysis, politics, and general publications. Use this for research questions, current events, scientific studies, news analysis, and academic research topics."
  );
export type GetArticlesInput = z.input<typeof getArticlesInputSchema>;

export const getArticlesOutputSchema = z
  .object({
    baseUrl: z.string().describe("The base url of the articles."),
    articles: z.array(
      z.object({
        title: z.string().describe("The title of the article."),
        url: z.string().describe("The url of the article."),
        slug: z.string().describe("The slug of the article."),
        locale: z.string().describe("The locale of the article."),
      })
    ),
  })
  .describe(
    "The output schema for the getArticles tool. The articles are from Nakafa platform."
  );
export type GetArticlesOutput = z.output<typeof getArticlesOutputSchema>;

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
    "Get educational subjects from Nakafa platform - structured learning materials and curricula from K-12 through university level. Use this for study questions, homework help, learning concepts, educational content, and curriculum-based topics."
  );
export type GetSubjectsInput = z.input<typeof getSubjectsInputSchema>;

export const getSubjectsOutputSchema = z
  .object({
    baseUrl: z.string().describe("The base url of the subjects."),
    subjects: z.array(
      z.object({
        title: z.string().describe("The title of the subject."),
        url: z.string().describe("The url of the subject."),
        slug: z.string().describe("The slug of the subject."),
        locale: z.string().describe("The locale of the subject."),
      })
    ),
  })
  .describe(
    "The output schema for the getSubjects tool. The subjects are K-12 to university level."
  );
export type GetSubjectsOutput = z.output<typeof getSubjectsOutputSchema>;

export const getContentInputSchema = z
  .object({
    locale: z.enum(["en", "id"]).describe("The locale of the content to get."),
    slug: z
      .string()
      .describe(
        "The slug of the content to get - MUST be a verified slug returned from getSubjects or getArticles responses. Use slug exactly as returned. Always start with slash (/). DO NOT include locale in the slug. NEVER use unverified slugs."
      ),
  })
  .describe(
    "Get the full content from Nakafa platform. CRITICAL: ONLY use this with slugs that were returned from getSubjects or getArticles responses. NEVER use with guessed, assumed, or unverified slugs."
  );
export type GetContentInput = z.input<typeof getContentInputSchema>;

export const getContentOutputSchema = z
  .object({
    url: z.string().describe("The url of the content from Nakafa."),
    content: z.string().describe("The content of the page."),
  })
  .describe(
    "The output schema for the getContent tool. The content is the full content of the page."
  );
export type GetContentOutput = z.output<typeof getContentOutputSchema>;

export const calculatorInputSchema = z
  .object({
    expression: z
      .string()
      .describe(
        "A mathematical expression with concrete numbers and operations. Use ONLY evaluable expressions with numbers - NOT algebraic variables. Compatible with Math.js."
      ),
  })
  .describe(
    "MANDATORY calculator tool - ALWAYS use this for ANY mathematical calculation including simple arithmetic. NEVER calculate manually. Only use for evaluable expressions with concrete numbers, not algebraic variables."
  );
export type CalculatorInput = z.input<typeof calculatorInputSchema>;

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
export type CalculatorOutput = z.output<typeof calculatorOutputSchema>;

const MAX_URL_LENGTH = 100;

export const scrapeInputSchema = z
  .object({
    urlToCrawl: z
      .url()
      .min(1)
      .max(MAX_URL_LENGTH)
      .describe("The URL to scrape (including http:// or https://)"),
  })
  .describe("Get the content of a URL");
export type ScrapeInput = z.input<typeof scrapeInputSchema>;

export const scrapeOutputSchema = z.object({
  data: z.object({
    url: z.string(),
    content: z.string(),
  }),
  error: z.string().optional(),
});
export type ScrapeOutput = z.output<typeof scrapeOutputSchema>;

export const webSearchInputSchema = z
  .object({
    query: z.string().describe("The query to search the web for"),
  })
  .describe("Search the web for up-to-date information using a text query");
export type WebSearchInput = z.input<typeof webSearchInputSchema>;

export const webSearchOutputSchema = z
  .object({
    data: z.object({
      news: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          url: z.string(),
          citation: z.string(),
          content: z.string(),
        })
      ),
      web: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          url: z.string(),
          citation: z.string(),
          content: z.string(),
        })
      ),
    }),
    error: z.string().optional(),
  })
  .describe(
    "The output schema for web search results including news and web content"
  );
export type WebSearchOutput = z.output<typeof webSearchOutputSchema>;
