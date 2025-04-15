import { z } from "zod";

export const MaterialListSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  href: z.string(),
  items: z.array(
    z.object({
      title: z.string(),
      href: z.string(),
    })
  ),
});
export type MaterialList = z.infer<typeof MaterialListSchema>;
