import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";

export interface ExerciseSetPayload {
  category: string;
  contentHash: string;
  description?: string;
  exerciseType: string;
  locale: Locale;
  material: string;
  questionCount: number;
  searchDescription: string;
  searchText: string;
  searchTitle: string;
  setName: string;
  slug: string;
  title: string;
  type: string;
}

export interface QuestionChoice {
  isCorrect: boolean;
  label: string;
  optionKey: string;
  order: number;
}

export interface ExerciseQuestionPayload {
  answerBody: string;
  authors: Array<{ name: string }>;
  category: string;
  choices: QuestionChoice[];
  contentHash: string;
  date: number;
  description?: string;
  exerciseType: string;
  locale: Locale;
  material: string;
  number: number;
  questionBody: string;
  searchDescription: string;
  searchText: string;
  searchTitle: string;
  setName: string;
  setSlug: string;
  slug: string;
  title: string;
  type: string;
}

export interface ExerciseSearchLabels {
  exerciseTypeTitle: string;
  setTitle: string;
}
