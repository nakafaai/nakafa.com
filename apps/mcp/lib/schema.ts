import { z } from "zod";

export const GetContentsSchema = z.object({
  locale: z
    .enum(["en", "id"])
    .default("en")
    .describe(
      "Language locale for content retrieval. 'en' for English, 'id' for Indonesian (Bahasa Indonesia)."
    ),
  type: z
    .enum(["subject", "articles"])
    .default("subject")
    .describe(
      "Content type filter: 'subject' for educational subjects and course materials, 'articles' for political analysis and educational articles."
    ),
});

export const getContentSchema = z.object({
  slug: z
    .string()
    .describe(
      "The slug of the content to get. The slug can be found in the 'slug' field of the 'get_contents' tool."
    ),
});
