import * as z from "zod";

const componentUsageSchema = z.object({
  input: z.number(),
  output: z.number(),
});
export type ComponentUsage = z.infer<typeof componentUsageSchema>;

export const metadataSchema = z.object({
  model: z.string(),
  tokens: z.optional(
    z.object({
      input: z.optional(z.number()),
      output: z.optional(z.number()),
      total: z.optional(z.number()),
      breakdown: z.optional(
        z.object({
          main: componentUsageSchema,
          subAgents: z.record(z.string(), componentUsageSchema),
        })
      ),
    })
  ),
});

export type Metadata = z.infer<typeof metadataSchema>;
