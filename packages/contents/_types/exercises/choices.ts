import * as z from "zod";

const ChoicesItemSchema = z.object({
  label: z.string(),
  value: z.boolean(),
});

export const ExercisesChoicesSchema = z.object({
  id: z.array(ChoicesItemSchema),
  en: z.array(ChoicesItemSchema),
});

export type ExercisesChoices = z.infer<typeof ExercisesChoicesSchema>;
