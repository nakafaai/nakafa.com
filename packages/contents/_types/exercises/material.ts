import * as z from "zod";

export const MaterialListSchema = z.array(
  z.object({
    title: z.string(),
    description: z.string().optional(),
    href: z.string(),
    items: z.array(
      z.object({
        title: z.string(),
        href: z.string(),
      })
    ),
  })
);
export type MaterialList = z.infer<typeof MaterialListSchema>;

export const ExercisesMaterialSchema = z.enum(["mathematics"]);
export type ExercisesMaterial = z.infer<typeof ExercisesMaterialSchema>;
