import * as z from "zod";

export const ArticleSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.string(),
  slug: z.string(),
  official: z.boolean(),
});
export type Article = z.infer<typeof ArticleSchema>;

export const ReferenceSchema = z.object({
  title: z.string(),
  authors: z.string(),
  year: z.number(),
  url: z.string().optional(),
  citation: z.string().optional(), // For handling 2024a, 2024b style citations
  publication: z.string().optional(),
  details: z.string().optional(),
});
export type Reference = z.infer<typeof ReferenceSchema>;

export const ContentMetadataSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  authors: z.array(
    z.object({
      name: z.string(),
    })
  ),
  date: z.string(),
  subject: z.string().optional(),
});
export type ContentMetadata = z.infer<typeof ContentMetadataSchema>;

export const ContentPaginationSchema = z.object({
  prev: z.object({
    href: z.string(),
    title: z.string(),
  }),
  next: z.object({
    href: z.string(),
    title: z.string(),
  }),
});
export type ContentPagination = z.infer<typeof ContentPaginationSchema>;

export const ContentSchema = z.object({
  metadata: ContentMetadataSchema,
  raw: z.string(),
  url: z.string(),
  slug: z.string(),
});
export type Content = z.infer<typeof ContentSchema>;
