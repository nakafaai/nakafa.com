import { learningInterestValidator } from "@repo/backend/convex/learningPrograms/spec";
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const curriculumProgramOptionValidator = v.object({
  countryCode: v.optional(v.string()),
  key: v.string(),
  publicSlug: v.string(),
  title: v.string(),
});

export const tryoutCountryOptionValidator = v.object({
  countryCode: v.string(),
  key: v.string(),
  publicPath: v.string(),
  title: v.string(),
});

export const currentLearningPreferenceValidator = v.union(
  v.null(),
  v.object({
    preferredCurriculumProgramKey: v.string(),
    program: curriculumProgramOptionValidator,
  })
);

export const currentTryoutPreferenceValidator = v.union(
  v.null(),
  v.object({
    country: tryoutCountryOptionValidator,
    preferredTryoutCountryKey: v.string(),
  })
);

const tables = {
  learningPreferences: defineTable({
    learningInterest: v.optional(learningInterestValidator),
    primaryProgramKey: v.optional(v.string()),
    preferredCurriculumProgramKey: v.optional(v.string()),
    preferredTryoutCountryKey: v.optional(v.string()),
    selectionUpdatedAt: v.optional(v.number()),
    updatedAt: v.number(),
    userId: v.id("users"),
  }).index("by_userId", ["userId"]),
};

export default tables;
