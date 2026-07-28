import {
  assessmentImportJobStatusValidator,
  assessmentQuestionTypeValidator,
  richContentValidator,
} from "@repo/backend/convex/assessments/schema";
import { v } from "convex/values";

/** AI import workflow job row. */
export const schoolAssessmentImportJobValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.optional(v.id("schoolClasses")),
  assessmentId: v.optional(v.id("schoolAssessments")),
  status: assessmentImportJobStatusValidator,
  sourceName: v.string(),
  sourceStorageId: v.optional(v.id("_storage")),
  createdBy: v.id("users"),
  updatedAt: v.number(),
  errorMessage: v.optional(v.string()),
});

/** Draft question produced by AI import before teacher review. */
export const schoolAssessmentImportDraftValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.optional(v.id("schoolClasses")),
  importJobId: v.id("schoolAssessmentImportJobs"),
  questionType: assessmentQuestionTypeValidator,
  stem: richContentValidator,
  explanation: v.optional(richContentValidator),
  points: v.number(),
  choiceDrafts: v.array(
    v.object({
      key: v.string(),
      content: richContentValidator,
      isCorrect: v.boolean(),
    })
  ),
  rubricDrafts: v.array(
    v.object({
      label: v.string(),
      description: v.optional(richContentValidator),
      maxScore: v.number(),
    })
  ),
  importedAt: v.number(),
});
