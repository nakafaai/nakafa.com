import * as z from "zod";

export const errorSchema = z.object({
  message: z.string(),
});

export const contentsSchema = z.array(
  z.object({
    title: z.string(),
    url: z.string(),
    slug: z.string(),
    locale: z.string(),
  })
);

export const dataPartSchema = z.object({
  suggestions: z.object({
    data: z.array(z.string()),
  }),
  "get-articles": z.object({
    baseUrl: z.string(),
    articles: contentsSchema,
    status: z.enum(["loading", "done", "error"]),
    error: errorSchema.optional(),
  }),
  "get-subjects": z.object({
    baseUrl: z.string(),
    subjects: contentsSchema,
    status: z.enum(["loading", "done", "error"]),
    error: errorSchema.optional(),
  }),
  "get-content": z.object({
    url: z.string(),
    content: z.string(),
    status: z.enum(["loading", "done", "error"]),
    error: errorSchema.optional(),
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
  }),
  "scrape-url": z.object({
    url: z.string(),
    content: z.string(),
    status: z.enum(["loading", "done", "error"]),
    error: errorSchema.optional(),
  }),
  "web-search": z.object({
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
    error: errorSchema.optional(),
  }),
});

export type DataPart = z.infer<typeof dataPartSchema>;
