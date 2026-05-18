import { Schema } from "effect";

export const SUBJECT_CATEGORIES = [
  "elementary-school",
  "middle-school",
  "high-school",
  "university",
] as const;

export const SubjectCategorySchema = Schema.Literal(...SUBJECT_CATEGORIES);
export type SubjectCategory = Schema.Schema.Type<typeof SubjectCategorySchema>;
