import * as z from "zod";
import {
  getArticlesInputSchema,
  getSubjectsInputSchema,
} from "../schema/tools";

export const contentsSchema = z.object({
  title: z.string(),
  url: z.string(),
  slug: z.string(),
  locale: z.string(),
});

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
  "create-dataset": z.object({
    datasetId: z.string().optional(),
    query: z.string(),
    targetRows: z.number(),
    status: z.enum(["loading", "done", "error"]),
    error: z.string().optional(),
  }),
});

export type DataPart = z.infer<typeof dataPartSchema>;
