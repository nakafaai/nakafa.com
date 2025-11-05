import * as z from "zod";

export const ExercisesCategorySchema = z.enum(["high-school"]);
export type ExercisesCategory = z.infer<typeof ExercisesCategorySchema>;
