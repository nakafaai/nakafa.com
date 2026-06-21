import type { ExercisesChoices } from "@repo/contents/_types/assessment/choices";
import type { ContentWithMDX } from "@repo/contents/_types/content";

export interface Exercise {
  answer: ContentWithMDX;
  choices: ExercisesChoices;
  number: number;
  question: ContentWithMDX;
}

export type ExerciseWithoutDefaults = Omit<Exercise, "question" | "answer"> & {
  question: Omit<ContentWithMDX, "default">;
  answer: Omit<ContentWithMDX, "default">;
};
