import * as z from "zod";

export const ExercisesTypeSchema = z.enum(["grade-9", "tka", "snbt"]);
export type ExercisesType = z.infer<typeof ExercisesTypeSchema>;
