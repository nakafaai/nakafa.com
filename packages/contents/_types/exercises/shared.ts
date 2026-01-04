import type { ContentWithMDX } from "@repo/contents/_types/content";
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

export interface Exercise {
  number: number;
  choices: ExercisesChoices;
  question: ContentWithMDX;
  answer: ContentWithMDX;
}

export type ExerciseWithoutDefaults = Omit<Exercise, "question" | "answer"> & {
  question: Omit<ContentWithMDX, "default">;
  answer: Omit<ContentWithMDX, "default">;
};
