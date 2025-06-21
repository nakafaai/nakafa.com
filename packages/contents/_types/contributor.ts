import { z } from "zod/v4";

export const contributorSchema = z.object({
  name: z.string(),
  username: z.string(),
  official: z.boolean(),
  social: z
    .object({
      twitter: z.url().optional(),
      github: z.url().optional(),
      linkedin: z.url().optional(),
    })
    .optional(),
});

export type Contributor = z.infer<typeof contributorSchema>;
