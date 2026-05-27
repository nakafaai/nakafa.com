import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import {
  assessmentAssignmentStatusSchema,
  assessmentAttemptEventTypeSchema,
  assessmentAttemptStatusSchema,
  assessmentFlagReviewStatusSchema,
  assessmentFlagSeveritySchema,
  assessmentGradingModeSchema,
  assessmentGradingStatusSchema,
  assessmentMonitoringModeSchema,
  assessmentQuestionTypeSchema,
  assessmentRankingScopeSchema,
  assessmentReleaseModeSchema,
  assessmentRetakePolicySchema,
  assessmentSessionStatusSchema,
  assessmentTimingPolicySchema,
  richContentSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

/** Publish instance visible to students through class targets. */
export const schoolAssessmentAssignmentSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  assessmentId: GenericId.GenericId("schoolAssessments"),
  versionId: GenericId.GenericId("schoolAssessmentVersions"),
  title: Schema.String,
  status: assessmentAssignmentStatusSchema,
  opensAt: Schema.optional(Schema.Number),
  closesAt: Schema.optional(Schema.Number),
  releasesAt: Schema.optional(Schema.Number),
  timingPolicy: assessmentTimingPolicySchema,
  gradingMode: assessmentGradingModeSchema,
  monitoringMode: assessmentMonitoringModeSchema,
  releaseMode: assessmentReleaseModeSchema,
  rankingScope: assessmentRankingScopeSchema,
  retakePolicy: assessmentRetakePolicySchema,
  createdBy: GenericId.GenericId("users"),
  updatedBy: Schema.optional(GenericId.GenericId("users")),
  updatedAt: Schema.Number,
  publishedAt: Schema.optional(Schema.Number),
  archivedAt: Schema.optional(Schema.Number),
});

/** One target class per assignment row. */
export const schoolAssessmentAssignmentTargetSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: GenericId.GenericId("schoolClasses"),
  assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
});

/** Student attempt lifecycle row. */
export const schoolAssessmentAttemptSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: GenericId.GenericId("schoolClasses"),
  assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
  targetId: GenericId.GenericId("schoolAssessmentAssignmentTargets"),
  assessmentId: GenericId.GenericId("schoolAssessments"),
  versionId: GenericId.GenericId("schoolAssessmentVersions"),
  studentId: GenericId.GenericId("users"),
  status: assessmentAttemptStatusSchema,
  gradingStatus: assessmentGradingStatusSchema,
  attemptNumber: Schema.Number,
  startedAt: Schema.Number,
  expiresAt: Schema.optional(Schema.Number),
  submittedAt: Schema.optional(Schema.Number),
  completedAt: Schema.optional(Schema.Number),
  releasedAt: Schema.optional(Schema.Number),
  score: Schema.optional(Schema.Number),
  releasedScore: Schema.optional(Schema.Number),
});

/** Per-section runtime rows. */
export const schoolAssessmentSectionAttemptSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: GenericId.GenericId("schoolClasses"),
  attemptId: GenericId.GenericId("schoolAssessmentAttempts"),
  sectionId: GenericId.GenericId("schoolAssessmentVersionSections"),
  startedAt: Schema.optional(Schema.Number),
  submittedAt: Schema.optional(Schema.Number),
  expiresAt: Schema.optional(Schema.Number),
});

/** One response per attempt/question pair. */
export const schoolAssessmentResponseSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: GenericId.GenericId("schoolClasses"),
  assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
  attemptId: GenericId.GenericId("schoolAssessmentAttempts"),
  questionId: GenericId.GenericId("schoolAssessmentVersionQuestions"),
  questionType: assessmentQuestionTypeSchema,
  selectedChoiceIds: Schema.optional(
    Schema.Array(GenericId.GenericId("schoolAssessmentVersionChoices"))
  ),
  essayContent: Schema.optional(richContentSchema),
  essayAttachmentStorageIds: Schema.optional(
    Schema.Array(GenericId.GenericId("_storage"))
  ),
  isFinal: Schema.Boolean,
  submittedAt: Schema.Number,
  autoScore: Schema.optional(Schema.Number),
});

/** Manual or rubric-based essay grading row. */
export const schoolAssessmentEssayGradeSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: GenericId.GenericId("schoolClasses"),
  assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
  attemptId: GenericId.GenericId("schoolAssessmentAttempts"),
  responseId: GenericId.GenericId("schoolAssessmentResponses"),
  questionId: GenericId.GenericId("schoolAssessmentVersionQuestions"),
  criterionGrades: Schema.Array(
    Schema.Struct({
      criterionId: GenericId.GenericId("schoolAssessmentVersionRubricCriteria"),
      score: Schema.Number,
      feedback: Schema.optional(richContentSchema),
    })
  ),
  overallScore: Schema.Number,
  overallFeedback: Schema.optional(richContentSchema),
  gradedBy: GenericId.GenericId("users"),
  gradedAt: Schema.Number,
});

/** Released final grade row. */
export const schoolAssessmentFinalGradeSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: GenericId.GenericId("schoolClasses"),
  assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
  attemptId: GenericId.GenericId("schoolAssessmentAttempts"),
  studentId: GenericId.GenericId("users"),
  score: Schema.Number,
  releasedAt: Schema.Number,
  releasedBy: GenericId.GenericId("users"),
});

/** Latest mutable realtime session row. */
export const schoolAssessmentAttemptSessionSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: GenericId.GenericId("schoolClasses"),
  assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
  attemptId: GenericId.GenericId("schoolAssessmentAttempts"),
  studentId: GenericId.GenericId("users"),
  status: assessmentSessionStatusSchema,
  currentSectionId: Schema.optional(
    GenericId.GenericId("schoolAssessmentVersionSections")
  ),
  currentQuestionId: Schema.optional(
    GenericId.GenericId("schoolAssessmentVersionQuestions")
  ),
  lastSeenAt: Schema.Number,
  blurCount: Schema.Number,
  reconnectCount: Schema.Number,
  fullscreenExitCount: Schema.Number,
});

/** Append-only monitoring event row. */
export const schoolAssessmentAttemptEventSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: GenericId.GenericId("schoolClasses"),
  assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
  attemptId: GenericId.GenericId("schoolAssessmentAttempts"),
  studentId: GenericId.GenericId("users"),
  eventType: assessmentAttemptEventTypeSchema,
  occurredAt: Schema.Number,
  currentSectionId: Schema.optional(
    GenericId.GenericId("schoolAssessmentVersionSections")
  ),
  currentQuestionId: Schema.optional(
    GenericId.GenericId("schoolAssessmentVersionQuestions")
  ),
  fullscreenRequired: Schema.optional(Schema.Boolean),
});

/** Derived suspicion summary row. */
export const schoolAssessmentFlagSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: GenericId.GenericId("schoolClasses"),
  assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
  attemptId: GenericId.GenericId("schoolAssessmentAttempts"),
  studentId: GenericId.GenericId("users"),
  severity: assessmentFlagSeveritySchema,
  reviewStatus: assessmentFlagReviewStatusSchema,
  reason: Schema.String,
  details: Schema.optional(richContentSchema),
  reviewedBy: Schema.optional(GenericId.GenericId("users")),
  reviewedAt: Schema.optional(Schema.Number),
  createdAt: Schema.Number,
});

/** Per-student analytics rollup. */
export const schoolAssessmentStudentStatSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: GenericId.GenericId("schoolClasses"),
  assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
  studentId: GenericId.GenericId("users"),
  score: Schema.Number,
  percentile: Schema.optional(Schema.Number),
  rank: Schema.optional(Schema.Number),
  submittedAt: Schema.optional(Schema.Number),
});

/** Per-question analytics rollup. */
export const schoolAssessmentQuestionStatSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: Schema.optional(GenericId.GenericId("schoolClasses")),
  assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
  questionId: GenericId.GenericId("schoolAssessmentVersionQuestions"),
  submissionCount: Schema.Number,
  correctCount: Schema.optional(Schema.Number),
  averageScore: Schema.optional(Schema.Number),
});

/** Per-class analytics rollup. */
export const schoolAssessmentClassStatSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: GenericId.GenericId("schoolClasses"),
  assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
  participantCount: Schema.Number,
  submissionCount: Schema.Number,
  averageScore: Schema.optional(Schema.Number),
});

/** Ranking entry row for tryout-like assignments. */
export const schoolAssessmentLeaderboardEntrySchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: Schema.optional(GenericId.GenericId("schoolClasses")),
  assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
  studentId: GenericId.GenericId("users"),
  score: Schema.Number,
  rank: Schema.Number,
  rankingScope: assessmentRankingScopeSchema,
});

/** schoolAssessmentAssignments table definition. */
export const SchoolAssessmentAssignments = Table.make(
  "schoolAssessmentAssignments",
  schoolAssessmentAssignmentSchema
)
  .index("by_assessmentId_and_status", ["assessmentId", "status"])
  .index("by_schoolId_and_status", ["schoolId", "status"]);

/** schoolAssessmentAssignmentTargets table definition. */
export const SchoolAssessmentAssignmentTargets = Table.make(
  "schoolAssessmentAssignmentTargets",
  schoolAssessmentAssignmentTargetSchema
)
  .index("by_assignmentId_and_classId", ["assignmentId", "classId"])
  .index("by_classId_and_assignmentId", ["classId", "assignmentId"]);

/** schoolAssessmentAttempts table definition. */
export const SchoolAssessmentAttempts = Table.make(
  "schoolAssessmentAttempts",
  schoolAssessmentAttemptSchema
)
  .index("by_assignmentId_and_studentId_and_attemptNumber", [
    "assignmentId",
    "studentId",
    "attemptNumber",
  ])
  .index("by_assignmentId_and_studentId_and_status", [
    "assignmentId",
    "studentId",
    "status",
  ])
  .index("by_assignmentId_and_status", ["assignmentId", "status"])
  .index("by_studentId_and_assignmentId", ["studentId", "assignmentId"]);

/** schoolAssessmentSectionAttempts table definition. */
export const SchoolAssessmentSectionAttempts = Table.make(
  "schoolAssessmentSectionAttempts",
  schoolAssessmentSectionAttemptSchema
).index("by_attemptId_and_sectionId", ["attemptId", "sectionId"]);

/** schoolAssessmentResponses table definition. */
export const SchoolAssessmentResponses = Table.make(
  "schoolAssessmentResponses",
  schoolAssessmentResponseSchema
)
  .index("by_attemptId_and_questionId", ["attemptId", "questionId"])
  .index("by_questionId", ["questionId"]);

/** schoolAssessmentEssayGrades table definition. */
export const SchoolAssessmentEssayGrades = Table.make(
  "schoolAssessmentEssayGrades",
  schoolAssessmentEssayGradeSchema
)
  .index("by_responseId", ["responseId"])
  .index("by_attemptId", ["attemptId"]);

/** schoolAssessmentFinalGrades table definition. */
export const SchoolAssessmentFinalGrades = Table.make(
  "schoolAssessmentFinalGrades",
  schoolAssessmentFinalGradeSchema
).index("by_assignmentId_and_studentId", ["assignmentId", "studentId"]);

/** schoolAssessmentAttemptSessions table definition. */
export const SchoolAssessmentAttemptSessions = Table.make(
  "schoolAssessmentAttemptSessions",
  schoolAssessmentAttemptSessionSchema
)
  .index("by_attemptId", ["attemptId"])
  .index("by_assignmentId_and_status", ["assignmentId", "status"]);

/** schoolAssessmentAttemptEvents table definition. */
export const SchoolAssessmentAttemptEvents = Table.make(
  "schoolAssessmentAttemptEvents",
  schoolAssessmentAttemptEventSchema
)
  .index("by_attemptId_and_occurredAt", ["attemptId", "occurredAt"])
  .index("by_assignmentId_and_occurredAt", ["assignmentId", "occurredAt"]);

/** schoolAssessmentFlags table definition. */
export const SchoolAssessmentFlags = Table.make(
  "schoolAssessmentFlags",
  schoolAssessmentFlagSchema
)
  .index("by_assignmentId_and_reviewStatus", ["assignmentId", "reviewStatus"])
  .index("by_attemptId", ["attemptId"]);

/** schoolAssessmentStudentStats table definition. */
export const SchoolAssessmentStudentStats = Table.make(
  "schoolAssessmentStudentStats",
  schoolAssessmentStudentStatSchema
).index("by_assignmentId_and_studentId", ["assignmentId", "studentId"]);

/** schoolAssessmentQuestionStats table definition. */
export const SchoolAssessmentQuestionStats = Table.make(
  "schoolAssessmentQuestionStats",
  schoolAssessmentQuestionStatSchema
).index("by_assignmentId_and_questionId", ["assignmentId", "questionId"]);

/** schoolAssessmentClassStats table definition. */
export const SchoolAssessmentClassStats = Table.make(
  "schoolAssessmentClassStats",
  schoolAssessmentClassStatSchema
).index("by_assignmentId_and_classId", ["assignmentId", "classId"]);

/** schoolAssessmentLeaderboardEntries table definition. */
export const SchoolAssessmentLeaderboardEntries = Table.make(
  "schoolAssessmentLeaderboardEntries",
  schoolAssessmentLeaderboardEntrySchema
)
  .index("by_assignmentId_and_rankingScope_and_rank", [
    "assignmentId",
    "rankingScope",
    "rank",
  ])
  .index("by_assignmentId_and_studentId", ["assignmentId", "studentId"]);
