import { v } from "convex/values";

const tryoutChoiceFields = {
  label: v.string(),
  optionKey: v.string(),
  order: v.number(),
};

/** One complete signed choice frozen into an attempt or public demonstration. */
export const tryoutChoiceSnapshotValidator = v.object({
  ...tryoutChoiceFields,
  isCorrect: v.boolean(),
});

/** One runtime choice whose correctness is visible only during review. */
export const tryoutRuntimeChoiceValidator = v.object({
  ...tryoutChoiceFields,
  isCorrect: v.optional(v.boolean()),
});
