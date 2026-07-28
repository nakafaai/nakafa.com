import {
  assessmentAttemptEventTypeValidator,
  assessmentFlagReviewStatusValidator,
  assessmentFlagSeverityValidator,
  assessmentSessionStatusValidator,
  richContentValidator,
} from "@repo/backend/convex/assessments/schema";
import { v } from "convex/values";

/** Latest mutable realtime assessment session row. */
export const schoolAssessmentAttemptSessionValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.id("schoolClasses"),
  assignmentId: v.id("schoolAssessmentAssignments"),
  attemptId: v.id("schoolAssessmentAttempts"),
  studentId: v.id("users"),
  status: assessmentSessionStatusValidator,
  currentSectionId: v.optional(v.id("schoolAssessmentVersionSections")),
  currentQuestionId: v.optional(v.id("schoolAssessmentVersionQuestions")),
  lastSeenAt: v.number(),
  blurCount: v.number(),
  reconnectCount: v.number(),
  fullscreenExitCount: v.number(),
});

/** Append-only assessment monitoring event row. */
export const schoolAssessmentAttemptEventValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.id("schoolClasses"),
  assignmentId: v.id("schoolAssessmentAssignments"),
  attemptId: v.id("schoolAssessmentAttempts"),
  studentId: v.id("users"),
  eventType: assessmentAttemptEventTypeValidator,
  occurredAt: v.number(),
  currentSectionId: v.optional(v.id("schoolAssessmentVersionSections")),
  currentQuestionId: v.optional(v.id("schoolAssessmentVersionQuestions")),
  fullscreenRequired: v.optional(v.boolean()),
});

/** Derived assessment monitoring suspicion row. */
export const schoolAssessmentFlagValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.id("schoolClasses"),
  assignmentId: v.id("schoolAssessmentAssignments"),
  attemptId: v.id("schoolAssessmentAttempts"),
  studentId: v.id("users"),
  severity: assessmentFlagSeverityValidator,
  reviewStatus: assessmentFlagReviewStatusValidator,
  reason: v.string(),
  details: v.optional(richContentValidator),
  reviewedBy: v.optional(v.id("users")),
  reviewedAt: v.optional(v.number()),
  createdAt: v.number(),
});
