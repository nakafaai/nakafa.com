import * as z from "zod";

/**
 * Zod schema for Schema.org Person type
 * Used for authors in Article and other content
 */
export const PersonSchema = z.object({
  "@type": z.literal("Person"),
  name: z.string(),
  url: z.string().optional(),
});

export type Person = z.infer<typeof PersonSchema>;

/**
 * Helper function to create a Person object
 * Ensures type safety without assertions
 */
export function createPerson(name: string, url?: string): Person {
  return PersonSchema.parse({
    "@type": "Person",
    name,
    url,
  });
}

/**
 * Zod schema for Schema.org ImageObject type
 * Used for images in Article and other content
 */
export const ImageObjectSchema = z.object({
  "@type": z.literal("ImageObject"),
  url: z.string(),
});

export type ImageObject = z.infer<typeof ImageObjectSchema>;

/**
 * Zod schema for Schema.org Organization type
 * Used for publisher in Article
 */
export const OrganizationSchema = z.object({
  "@type": z.literal("Organization"),
  name: z.string(),
  url: z.string(),
  logo: z.union([z.string(), ImageObjectSchema]).optional(),
  sameAs: z.array(z.string()).optional(),
});

export type Organization = z.infer<typeof OrganizationSchema>;

/**
 * Zod schema for Schema.org Article type
 * Validates Article structured data
 */
export const ArticleSchema = z.object({
  "@context": z.literal("https://schema.org"),
  "@type": z.literal("Article"),
  name: z.string(),
  headline: z.string(),
  url: z.string(),
  mainEntityOfPage: z
    .object({
      "@type": z.literal("WebPage"),
      "@id": z.string(),
    })
    .optional(),
  datePublished: z.string(),
  dateModified: z.string().optional(),
  author: z.union([PersonSchema, z.array(PersonSchema)]),
  image: z.union([ImageObjectSchema, z.array(ImageObjectSchema)]).optional(),
  description: z.string(),
  publisher: OrganizationSchema.optional(),
});

export type Article = z.infer<typeof ArticleSchema>;
