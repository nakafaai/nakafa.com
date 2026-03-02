import * as z from "zod";

const tokenBreakdownSchema = z.object({
  input: z.number(),
  output: z.number(),
});

export const metadataSchema = z.object({
  model: z.string(),
  tokens: z.optional(
    z.object({
      input: z.optional(z.number()),
      output: z.optional(z.number()),
      total: z.optional(z.number()),
      breakdown: z.optional(
        z.object({
          main: tokenBreakdownSchema,
          contentAccess: tokenBreakdownSchema.optional(),
          math: tokenBreakdownSchema.optional(),
          research: tokenBreakdownSchema.optional(),
        })
      ),
    })
  ),
});

export type Metadata = z.infer<typeof metadataSchema>;
