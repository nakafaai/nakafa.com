import { defineTable } from "convex/server";
import { v } from "convex/values";

export const curriculumProgramOptionValidator = v.object({
  countryCode: v.optional(v.string()),
  key: v.string(),
  publicSlug: v.string(),
  title: v.string(),
});

export const currentLearningPreferenceValidator = v.union(
  v.null(),
  v.object({
    preferredCurriculumProgramKey: v.string(),
    program: curriculumProgramOptionValidator,
  })
);

const tables = {
  learningPreferences: defineTable({
    preferredCurriculumProgramKey: v.string(),
    updatedAt: v.number(),
    userId: v.id("users"),
  }).index("by_userId", ["userId"]),
};

export default tables;
