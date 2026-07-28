import { assessmentRankingScopeValidator } from "@repo/backend/convex/assessments/schema";
import { v } from "convex/values";

/** Per-student assessment analytics rollup. */
export const schoolAssessmentStudentStatValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.id("schoolClasses"),
  assignmentId: v.id("schoolAssessmentAssignments"),
  studentId: v.id("users"),
  score: v.number(),
  percentile: v.optional(v.number()),
  rank: v.optional(v.number()),
  submittedAt: v.optional(v.number()),
});

/** Per-question assessment analytics rollup. */
export const schoolAssessmentQuestionStatValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.optional(v.id("schoolClasses")),
  assignmentId: v.id("schoolAssessmentAssignments"),
  questionId: v.id("schoolAssessmentVersionQuestions"),
  submissionCount: v.number(),
  correctCount: v.optional(v.number()),
  averageScore: v.optional(v.number()),
});

/** Per-class assessment analytics rollup. */
export const schoolAssessmentClassStatValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.id("schoolClasses"),
  assignmentId: v.id("schoolAssessmentAssignments"),
  participantCount: v.number(),
  submissionCount: v.number(),
  averageScore: v.optional(v.number()),
});

/** Ranking entry for one tryout-like assessment assignment. */
export const schoolAssessmentLeaderboardEntryValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.optional(v.id("schoolClasses")),
  assignmentId: v.id("schoolAssessmentAssignments"),
  studentId: v.id("users"),
  score: v.number(),
  rank: v.number(),
  rankingScope: assessmentRankingScopeValidator,
});
