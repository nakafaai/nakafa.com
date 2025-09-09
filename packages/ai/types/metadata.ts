import * as z from "zod";

export const metadataSchema = z.object({
  model: z.string(),
});

export type Metadata = z.infer<typeof metadataSchema>;
