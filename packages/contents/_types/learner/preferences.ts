import { LearningProgramKindSchema } from "@nakafa/aksara-contracts/program/spec";
import { Schema } from "effect";
export const LEARNING_INTEREST_VALUES = [
  "school-curriculum",
  "exam-prep",
  "assessment-prep",
] as const;
export const LearningInterestSchema = Schema.Literals(LEARNING_INTEREST_VALUES);
export type LearningInterest = typeof LearningInterestSchema.Type;
export const LEARNING_INTEREST_PROGRAM_KIND_MATCHES = Schema.decodeSync(
  Schema.Record(LearningInterestSchema, Schema.Array(LearningProgramKindSchema))
)({
  "assessment-prep": ["assessment", "admission-exam"],
  "exam-prep": ["admission-exam"],
  "school-curriculum": ["school-curriculum"],
});
