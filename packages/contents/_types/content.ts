import { isContentDateString } from "@repo/contents/_shared/date";
import type React from "react";
import * as z from "zod";

/** Locale validation schema - single source of truth */
export const LocaleSchema = z.enum(["en", "id"]);
export type Locale = z.infer<typeof LocaleSchema>;

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
  date: z.string().refine(isContentDateString, {
    error: "Invalid content date. Expected MM/DD/YYYY.",
  }),
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
  locale: LocaleSchema,
  slug: z.string(),
});
export type Content = z.infer<typeof ContentSchema>;

export type ContentWithMDX = Omit<Content, "url" | "locale" | "slug"> & {
  default?: React.ReactElement;
};

/**
 * Content payload for page-rendering paths that only need validated metadata
 * and the compiled MDX element.
 *
 * Unlike `ContentWithMDX`, this type intentionally omits the raw MDX source so
 * render-focused callers can avoid an extra filesystem read when source text is
 * not consumed.
 */
export type RenderableContent = Omit<ContentWithMDX, "raw">;

export type ContentListWithMDX = Content & {
  default?: React.ReactElement;
};
