import * as z from "zod";

export const ExercisesCategorySchema = z.enum(["high-school", "middle-school"]);
export type ExercisesCategory = z.infer<typeof ExercisesCategorySchema>;
