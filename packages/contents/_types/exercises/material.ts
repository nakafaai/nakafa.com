import * as z from "zod";

export const ExercisesMaterialListSchema = z.array(
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
export type ExercisesMaterialList = z.infer<typeof ExercisesMaterialListSchema>;

export const ExercisesMaterialSchema = z.enum([
  "mathematics",
  "quantitative-reasoning",
]);
export type ExercisesMaterial = z.infer<typeof ExercisesMaterialSchema>;
