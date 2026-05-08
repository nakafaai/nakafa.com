import {
  getArticlesInputSchema,
  getSubjectsInputSchema,
} from "@repo/ai/agents/content/schema";
import * as z from "zod";

/**
 * Schema for content items used by content-list data parts.
 */
export const contentsSchema = z.object({
  title: z.string(),
  url: z.string(),
  slug: z.string(),
  locale: z.enum(["en", "id"]),
});

/**
 * Schema for UI data parts written by Nina agents.
 */
export const dataPartSchema = z.object({
  suggestions: z.object({
    data: z.array(z.string()),
  }),
  "get-articles": z.object({
    baseUrl: z.string(),
    input: getArticlesInputSchema,
    articles: z.array(contentsSchema),
    status: z.enum(["loading", "done", "error"]),
    error: z.string().optional(),
  }),
  "get-subjects": z.object({
    baseUrl: z.string(),
    input: getSubjectsInputSchema,
    subjects: z.array(contentsSchema),
    status: z.enum(["loading", "done", "error"]),
    error: z.string().optional(),
  }),
  "get-content": z.object({
    url: z.string(),
    title: z.string(),
    description: z.string(),
    status: z.enum(["loading", "done", "error"]),
    error: z.string().optional(),
  }),
  calculator: z.object({
    original: z.object({
      expression: z.string(),
      latex: z.string(),
    }),
    result: z.object({
      expression: z.string(),
      latex: z.string(),
      value: z.string(),
    }),
    status: z.enum(["done", "error"]),
    error: z.string().optional(),
  }),
  "scrape-url": z.object({
    url: z.string(),
    content: z.string(),
    status: z.enum(["loading", "done", "error"]),
    error: z.string().optional(),
  }),
  "web-search": z.object({
    query: z.string(),
    sources: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        url: z.string(),
        content: z.string(),
        citation: z.string(),
      })
    ),
    status: z.enum(["loading", "done", "error"]),
    error: z.string().optional(),
  }),
});

export type DataPart = z.infer<typeof dataPartSchema>;
