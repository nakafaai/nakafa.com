import { z } from "zod";

export const contributorSchema = z.object({
  name: z.string(),
  username: z.string(),
  social: z
    .object({
      twitter: z.string().url().optional(),
      github: z.string().url().optional(),
      linkedin: z.string().url().optional(),
    })
    .optional(),
});

export type Contributor = z.infer<typeof contributorSchema>;
