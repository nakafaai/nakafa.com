import type { ContentMetadata } from "@repo/contents/_types/content";
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";
import type { createElement } from "react";

export type Exercise = {
  number: number;
  choices: ExercisesChoices;
  question: {
    metadata: ContentMetadata;
    default: ReturnType<typeof createElement>;
    raw: string;
  };
  answer: {
    metadata: ContentMetadata;
    default: ReturnType<typeof createElement>;
    raw: string;
  };
};

export type ExerciseWithoutDefaults = Omit<Exercise, "question" | "answer"> & {
  question: Omit<Exercise["question"], "default">;
  answer: Omit<Exercise["answer"], "default">;
};
