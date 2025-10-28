import * as z from "zod";

export const metadataSchema = z.object({
  model: z.string(),
  tokens: z.optional(
    z.object({
      input: z.optional(z.number()),
      output: z.optional(z.number()),
      total: z.optional(z.number()),
    })
  ),
});

export type Metadata = z.infer<typeof metadataSchema>;
