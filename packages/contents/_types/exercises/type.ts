import * as z from "zod";

export const ExercisesTypeSchema = z.enum(["tka"]);
export type ExercisesType = z.infer<typeof ExercisesTypeSchema>;
