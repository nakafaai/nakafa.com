import { defineTable, paginationResultValidator } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  addFieldsToValidator,
  literals,
  systemFields,
} from "convex-helpers/validators";

/** Supported serialized rich content formats. */
export const richContentFormatValidator = literals("plate-v1");
export type RichContentFormat = Infer<typeof richContentFormatValidator>;

/** Serialized rich content payload persisted from Plate. */
export const richContentValidator = v.object({
  format: richContentFormatValidator,
  json: v.string(),
  text: v.string(),
});
export type RichContent = Infer<typeof richContentValidator>;

/** Assessment mode presets exposed to School users. */
export const assessmentModeValidator = literals(
  "practice",
  "assignment",
  "quiz",
  "exam",
  "tryout"
);
export type AssessmentMode = Infer<typeof assessmentModeValidator>;

/** Assessment authoring lifecycle states. */
export const assessmentStatusValidator = literals(
  "draft",
  "scheduled",
  "published",
  "archived"
);

/** Delivery visibility for assignments. */
export const assessmentAssignmentStatusValidator = literals(
  "draft",
  "scheduled",
  "published",
  "closed",
  "archived"
);

/** Supported structured question types. */
export const assessmentQuestionTypeValidator = literals(
  "mcq-single",
  "mcq-multi",
  "essay"
);
export type AssessmentQuestionType = Infer<
  typeof assessmentQuestionTypeValidator
>;

/** Ranking scopes available for assessments. */
export const assessmentRankingScopeValidator = literals(
  "none",
  "class",
  "school"
);

/** Monitoring strictness presets. */
export const assessmentMonitoringModeValidator = literals(
  "off",
  "basic",
  "strict"
);

/** Grade release timing options. */
export const assessmentReleaseModeValidator = literals(
  "instant",
  "manual",
  "scheduled"
);

/** Grading modes across objective and essay questions. */
export const assessmentGradingModeValidator = literals(
  "auto",
  "manual",
  "hybrid"
);

/** Assignment target scopes for question banks. */
export const assessmentQuestionBankScopeValidator = literals("class", "school");

/** High-level attempt lifecycle states. */
export const assessmentAttemptStatusValidator = literals(
  "in-progress",
  "submitted",
  "auto-submitted",
  "graded",
  "released"
);

/** Grading pipeline states. */
export const assessmentGradingStatusValidator = literals(
  "pending",
  "auto-graded",
  "awaiting-manual-review",
  "graded"
);

/** Realtime session states for monitoring. */
export const assessmentSessionStatusValidator = literals(
  "online",
  "offline",
  "submitted"
);

/** Monitoring events captured during attempts. */
export const assessmentAttemptEventTypeValidator = literals(
  "heartbeat",
  "blur",
  "focus",
  "reconnect",
  "disconnect",
  "answer-saved",
  "submit",
  "fullscreen-exit",
  "paste",
  "copy",
  "idle"
);

/** Review states for monitoring flags. */
export const assessmentFlagReviewStatusValidator = literals(
  "open",
  "reviewed",
  "dismissed"
);

/** Severity levels for monitoring flags. */
export const assessmentFlagSeverityValidator = literals(
  "low",
  "medium",
  "high"
);

/** AI import job states. */
export const assessmentImportJobStatusValidator = literals(
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled"
);

/** Question bank item provenance. */
export const assessmentQuestionSourceValidator = literals(
  "manual",
  "bank",
  "ai-import"
);

/** Explicit retake policy contract. */
export const assessmentRetakePolicyValidator = v.object({
  allowRetake: v.boolean(),
  maxAttempts: v.optional(v.number()),
});

/** Explicit timing policy contract. */
export const assessmentTimingPolicyValidator = v.object({
  durationMinutes: v.optional(v.number()),
  perSection: v.boolean(),
});

/** Assessment-level authored document. */
export const schoolAssessmentValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.optional(v.id("schoolClasses")),
  title: v.string(),
  slug: v.string(),
  description: v.optional(richContentValidator),
  mode: assessmentModeValidator,
  status: assessmentStatusValidator,
  currentVersionId: v.optional(v.id("schoolAssessmentVersions")),
  questionBankScope: assessmentQuestionBankScopeValidator,
  createdBy: v.id("users"),
  updatedBy: v.optional(v.id("users")),
  archivedBy: v.optional(v.id("users")),
  scheduledAt: v.optional(v.number()),
  scheduledJobId: v.optional(v.id("_scheduled_functions")),
  publishedAt: v.optional(v.number()),
  publishedBy: v.optional(v.id("users")),
  updatedAt: v.number(),
  archivedAt: v.optional(v.number()),
});

const schoolAssessmentDocValidator = addFieldsToValidator(
  schoolAssessmentValidator,
  systemFields("schoolAssessments")
);

/** Immutable version snapshot metadata. */
export const schoolAssessmentVersionValidator = v.object({
  schoolId: v.id("schools"),
  assessmentId: v.id("schoolAssessments"),
  versionNumber: v.number(),
  title: v.string(),
  description: v.optional(richContentValidator),
  mode: assessmentModeValidator,
  instructions: v.optional(richContentValidator),
  timingPolicy: assessmentTimingPolicyValidator,
  gradingMode: assessmentGradingModeValidator,
  monitoringMode: assessmentMonitoringModeValidator,
  releaseMode: assessmentReleaseModeValidator,
  rankingScope: assessmentRankingScopeValidator,
  retakePolicy: assessmentRetakePolicyValidator,
  totalPoints: v.number(),
  totalQuestionCount: v.number(),
  createdBy: v.id("users"),
  createdAt: v.number(),
});

/** Authored section row attached to one assessment draft. */
export const schoolAssessmentSectionValidator = v.object({
  schoolId: v.id("schools"),
  assessmentId: v.id("schoolAssessments"),
  title: v.string(),
  description: v.optional(richContentValidator),
  order: v.number(),
  durationMinutes: v.optional(v.number()),
});

/** Immutable section snapshot row frozen into one version. */
export const schoolAssessmentVersionSectionValidator = v.object({
  schoolId: v.id("schools"),
  assessmentId: v.id("schoolAssessments"),
  versionId: v.id("schoolAssessmentVersions"),
  sourceSectionId: v.id("schoolAssessmentSections"),
  title: v.string(),
  description: v.optional(richContentValidator),
  order: v.number(),
  durationMinutes: v.optional(v.number()),
  questionCount: v.number(),
  totalPoints: v.number(),
});

/** Authored question row tied to one assessment draft. */
export const schoolAssessmentQuestionValidator = v.object({
  schoolId: v.id("schools"),
  assessmentId: v.id("schoolAssessments"),
  sectionId: v.id("schoolAssessmentSections"),
  questionType: assessmentQuestionTypeValidator,
  source: assessmentQuestionSourceValidator,
  stem: richContentValidator,
  explanation: v.optional(richContentValidator),
  order: v.number(),
  points: v.number(),
  required: v.boolean(),
  shuffleChoices: v.boolean(),
  maxSelectionCount: v.optional(v.number()),
  rubricCriterionCount: v.number(),
  choiceCount: v.number(),
  bankEntryId: v.optional(v.id("schoolAssessmentQuestionBankEntries")),
});

/** Immutable question snapshot row frozen into one version. */
export const schoolAssessmentVersionQuestionValidator = v.object({
  schoolId: v.id("schools"),
  assessmentId: v.id("schoolAssessments"),
  versionId: v.id("schoolAssessmentVersions"),
  sourceQuestionId: v.id("schoolAssessmentQuestions"),
  sectionId: v.id("schoolAssessmentVersionSections"),
  questionType: assessmentQuestionTypeValidator,
  source: assessmentQuestionSourceValidator,
  stem: richContentValidator,
  explanation: v.optional(richContentValidator),
  order: v.number(),
  points: v.number(),
  required: v.boolean(),
  shuffleChoices: v.boolean(),
  maxSelectionCount: v.optional(v.number()),
  rubricCriterionCount: v.number(),
  choiceCount: v.number(),
  bankEntryId: v.optional(v.id("schoolAssessmentQuestionBankEntries")),
});

/** Multiple choice option row on the authored draft. */
export const schoolAssessmentChoiceValidator = v.object({
  schoolId: v.id("schools"),
  assessmentId: v.id("schoolAssessments"),
  questionId: v.id("schoolAssessmentQuestions"),
  key: v.string(),
  content: richContentValidator,
  order: v.number(),
  isCorrect: v.boolean(),
});

/** Multiple choice option row frozen into one version. */
export const schoolAssessmentVersionChoiceValidator = v.object({
  schoolId: v.id("schools"),
  assessmentId: v.id("schoolAssessments"),
  versionId: v.id("schoolAssessmentVersions"),
  questionId: v.id("schoolAssessmentVersionQuestions"),
  sourceChoiceId: v.id("schoolAssessmentChoices"),
  key: v.string(),
  content: richContentValidator,
  order: v.number(),
  isCorrect: v.boolean(),
});

/** Essay rubric criterion row on the authored draft. */
export const schoolAssessmentRubricCriterionValidator = v.object({
  schoolId: v.id("schools"),
  assessmentId: v.id("schoolAssessments"),
  questionId: v.id("schoolAssessmentQuestions"),
  label: v.string(),
  description: v.optional(richContentValidator),
  maxScore: v.number(),
  order: v.number(),
});

/** Essay rubric criterion row frozen into one version. */
export const schoolAssessmentVersionRubricCriterionValidator = v.object({
  schoolId: v.id("schools"),
  assessmentId: v.id("schoolAssessments"),
  versionId: v.id("schoolAssessmentVersions"),
  questionId: v.id("schoolAssessmentVersionQuestions"),
  sourceCriterionId: v.id("schoolAssessmentRubricCriteria"),
  label: v.string(),
  description: v.optional(richContentValidator),
  maxScore: v.number(),
  order: v.number(),
});

/** Reusable question bank. */
export const schoolAssessmentQuestionBankValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.optional(v.id("schoolClasses")),
  scope: assessmentQuestionBankScopeValidator,
  title: v.string(),
  description: v.optional(richContentValidator),
  createdBy: v.id("users"),
  updatedBy: v.optional(v.id("users")),
  updatedAt: v.number(),
});

/** Question bank entry snapshot. */
export const schoolAssessmentQuestionBankEntryValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.optional(v.id("schoolClasses")),
  bankId: v.id("schoolAssessmentQuestionBanks"),
  questionType: assessmentQuestionTypeValidator,
  stem: richContentValidator,
  explanation: v.optional(richContentValidator),
  points: v.number(),
  shuffleChoices: v.boolean(),
  maxSelectionCount: v.optional(v.number()),
  source: assessmentQuestionSourceValidator,
  createdBy: v.id("users"),
  updatedBy: v.optional(v.id("users")),
  updatedAt: v.number(),
});

/** Publish instance visible to students through class targets. */
export const schoolAssessmentAssignmentValidator = v.object({
  schoolId: v.id("schools"),
  assessmentId: v.id("schoolAssessments"),
  versionId: v.id("schoolAssessmentVersions"),
  title: v.string(),
  status: assessmentAssignmentStatusValidator,
  opensAt: v.optional(v.number()),
  closesAt: v.optional(v.number()),
  releasesAt: v.optional(v.number()),
  timingPolicy: assessmentTimingPolicyValidator,
  gradingMode: assessmentGradingModeValidator,
  monitoringMode: assessmentMonitoringModeValidator,
  releaseMode: assessmentReleaseModeValidator,
  rankingScope: assessmentRankingScopeValidator,
  retakePolicy: assessmentRetakePolicyValidator,
  createdBy: v.id("users"),
  updatedBy: v.optional(v.id("users")),
  updatedAt: v.number(),
  publishedAt: v.optional(v.number()),
  archivedAt: v.optional(v.number()),
});

/** One target class per assignment row. */
export const schoolAssessmentAssignmentTargetValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.id("schoolClasses"),
  assignmentId: v.id("schoolAssessmentAssignments"),
});

/** Student attempt lifecycle row. */
export const schoolAssessmentAttemptValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.id("schoolClasses"),
  assignmentId: v.id("schoolAssessmentAssignments"),
  targetId: v.id("schoolAssessmentAssignmentTargets"),
  assessmentId: v.id("schoolAssessments"),
  versionId: v.id("schoolAssessmentVersions"),
  studentId: v.id("users"),
  status: assessmentAttemptStatusValidator,
  gradingStatus: assessmentGradingStatusValidator,
  attemptNumber: v.number(),
  startedAt: v.number(),
  expiresAt: v.optional(v.number()),
  submittedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  releasedAt: v.optional(v.number()),
  score: v.optional(v.number()),
  releasedScore: v.optional(v.number()),
});

/** Per-section runtime rows. */
export const schoolAssessmentSectionAttemptValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.id("schoolClasses"),
  attemptId: v.id("schoolAssessmentAttempts"),
  sectionId: v.id("schoolAssessmentVersionSections"),
  startedAt: v.optional(v.number()),
  submittedAt: v.optional(v.number()),
  expiresAt: v.optional(v.number()),
});

/** One response per attempt/question pair. */
export const schoolAssessmentResponseValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.id("schoolClasses"),
  assignmentId: v.id("schoolAssessmentAssignments"),
  attemptId: v.id("schoolAssessmentAttempts"),
  questionId: v.id("schoolAssessmentVersionQuestions"),
  questionType: assessmentQuestionTypeValidator,
  selectedChoiceIds: v.optional(
    v.array(v.id("schoolAssessmentVersionChoices"))
  ),
  essayContent: v.optional(richContentValidator),
  essayAttachmentStorageIds: v.optional(v.array(v.id("_storage"))),
  isFinal: v.boolean(),
  submittedAt: v.number(),
  autoScore: v.optional(v.number()),
});

/** Manual or rubric-based essay grading row. */
export const schoolAssessmentEssayGradeValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.id("schoolClasses"),
  assignmentId: v.id("schoolAssessmentAssignments"),
  attemptId: v.id("schoolAssessmentAttempts"),
  responseId: v.id("schoolAssessmentResponses"),
  questionId: v.id("schoolAssessmentVersionQuestions"),
  criterionGrades: v.array(
    v.object({
      criterionId: v.id("schoolAssessmentVersionRubricCriteria"),
      score: v.number(),
      feedback: v.optional(richContentValidator),
    })
  ),
  overallScore: v.number(),
  overallFeedback: v.optional(richContentValidator),
  gradedBy: v.id("users"),
  gradedAt: v.number(),
});

/** Released final grade row. */
export const schoolAssessmentFinalGradeValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.id("schoolClasses"),
  assignmentId: v.id("schoolAssessmentAssignments"),
  attemptId: v.id("schoolAssessmentAttempts"),
  studentId: v.id("users"),
  score: v.number(),
  releasedAt: v.number(),
  releasedBy: v.id("users"),
});

/** Latest mutable realtime session row. */
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

/** Append-only monitoring event row. */
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

/** Derived suspicion summary row. */
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

/** Per-student analytics rollup. */
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

/** Per-question analytics rollup. */
export const schoolAssessmentQuestionStatValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.optional(v.id("schoolClasses")),
  assignmentId: v.id("schoolAssessmentAssignments"),
  questionId: v.id("schoolAssessmentVersionQuestions"),
  submissionCount: v.number(),
  correctCount: v.optional(v.number()),
  averageScore: v.optional(v.number()),
});

/** Per-class analytics rollup. */
export const schoolAssessmentClassStatValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.id("schoolClasses"),
  assignmentId: v.id("schoolAssessmentAssignments"),
  participantCount: v.number(),
  submissionCount: v.number(),
  averageScore: v.optional(v.number()),
});

/** Ranking entry row for tryout-like assignments. */
export const schoolAssessmentLeaderboardEntryValidator = v.object({
  schoolId: v.id("schools"),
  classId: v.optional(v.id("schoolClasses")),
  assignmentId: v.id("schoolAssessmentAssignments"),
  studentId: v.id("users"),
  score: v.number(),
  rank: v.number(),
  rankingScope: assessmentRankingScopeValidator,
});

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

/** Draft questions produced by AI import before teacher review. */
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

/** Public list validator for authored assessments. */
export const paginatedSchoolAssessmentsValidator = paginationResultValidator(
  schoolAssessmentDocValidator
);

const schema = {
  schoolAssessments: defineTable(schoolAssessmentValidator)
    .index("by_schoolId_and_status", ["schoolId", "status"])
    .index("by_schoolId_and_slug", ["schoolId", "slug"])
    .index("by_schoolId_and_classId_and_status", [
      "schoolId",
      "classId",
      "status",
    ])
    .index("by_schoolId_and_updatedAt", ["schoolId", "updatedAt"])
    .index("by_schoolId_and_classId_and_updatedAt", [
      "schoolId",
      "classId",
      "updatedAt",
    ]),
  schoolAssessmentVersions: defineTable(schoolAssessmentVersionValidator).index(
    "by_assessmentId_and_versionNumber",
    ["assessmentId", "versionNumber"]
  ),
  schoolAssessmentSections: defineTable(schoolAssessmentSectionValidator).index(
    "by_assessmentId_and_order",
    ["assessmentId", "order"]
  ),
  schoolAssessmentVersionSections: defineTable(
    schoolAssessmentVersionSectionValidator
  ).index("by_versionId_and_order", ["versionId", "order"]),
  schoolAssessmentQuestions: defineTable(schoolAssessmentQuestionValidator)
    .index("by_assessmentId_and_sectionId_and_order", [
      "assessmentId",
      "sectionId",
      "order",
    ])
    .index("by_bankEntryId", ["bankEntryId"]),
  schoolAssessmentVersionQuestions: defineTable(
    schoolAssessmentVersionQuestionValidator
  )
    .index("by_versionId_and_sectionId_and_order", [
      "versionId",
      "sectionId",
      "order",
    ])
    .index("by_sourceQuestionId", ["sourceQuestionId"]),
  schoolAssessmentChoices: defineTable(schoolAssessmentChoiceValidator).index(
    "by_questionId_and_order",
    ["questionId", "order"]
  ),
  schoolAssessmentVersionChoices: defineTable(
    schoolAssessmentVersionChoiceValidator
  ).index("by_questionId_and_order", ["questionId", "order"]),
  schoolAssessmentRubricCriteria: defineTable(
    schoolAssessmentRubricCriterionValidator
  ).index("by_questionId_and_order", ["questionId", "order"]),
  schoolAssessmentVersionRubricCriteria: defineTable(
    schoolAssessmentVersionRubricCriterionValidator
  ).index("by_questionId_and_order", ["questionId", "order"]),
  schoolAssessmentQuestionBanks: defineTable(
    schoolAssessmentQuestionBankValidator
  )
    .index("by_schoolId_and_scope", ["schoolId", "scope"])
    .index("by_schoolId_and_classId", ["schoolId", "classId"]),
  schoolAssessmentQuestionBankEntries: defineTable(
    schoolAssessmentQuestionBankEntryValidator
  )
    .index("by_bankId", ["bankId"])
    .index("by_schoolId_and_classId", ["schoolId", "classId"]),
  schoolAssessmentAssignments: defineTable(schoolAssessmentAssignmentValidator)
    .index("by_assessmentId_and_status", ["assessmentId", "status"])
    .index("by_schoolId_and_status", ["schoolId", "status"]),
  schoolAssessmentAssignmentTargets: defineTable(
    schoolAssessmentAssignmentTargetValidator
  )
    .index("by_assignmentId_and_classId", ["assignmentId", "classId"])
    .index("by_classId_and_assignmentId", ["classId", "assignmentId"]),
  schoolAssessmentAttempts: defineTable(schoolAssessmentAttemptValidator)
    .index("by_assignmentId_and_studentId_and_attemptNumber", [
      "assignmentId",
      "studentId",
      "attemptNumber",
    ])
    .index("by_assignmentId_and_status", ["assignmentId", "status"])
    .index("by_studentId_and_assignmentId", ["studentId", "assignmentId"]),
  schoolAssessmentSectionAttempts: defineTable(
    schoolAssessmentSectionAttemptValidator
  ).index("by_attemptId_and_sectionId", ["attemptId", "sectionId"]),
  schoolAssessmentResponses: defineTable(schoolAssessmentResponseValidator)
    .index("by_attemptId_and_questionId", ["attemptId", "questionId"])
    .index("by_questionId", ["questionId"]),
  schoolAssessmentEssayGrades: defineTable(schoolAssessmentEssayGradeValidator)
    .index("by_responseId", ["responseId"])
    .index("by_attemptId", ["attemptId"]),
  schoolAssessmentFinalGrades: defineTable(
    schoolAssessmentFinalGradeValidator
  ).index("by_assignmentId_and_studentId", ["assignmentId", "studentId"]),
  schoolAssessmentAttemptSessions: defineTable(
    schoolAssessmentAttemptSessionValidator
  )
    .index("by_attemptId", ["attemptId"])
    .index("by_assignmentId_and_status", ["assignmentId", "status"]),
  schoolAssessmentAttemptEvents: defineTable(
    schoolAssessmentAttemptEventValidator
  )
    .index("by_attemptId_and_occurredAt", ["attemptId", "occurredAt"])
    .index("by_assignmentId_and_occurredAt", ["assignmentId", "occurredAt"]),
  schoolAssessmentFlags: defineTable(schoolAssessmentFlagValidator)
    .index("by_assignmentId_and_reviewStatus", ["assignmentId", "reviewStatus"])
    .index("by_attemptId", ["attemptId"]),
  schoolAssessmentStudentStats: defineTable(
    schoolAssessmentStudentStatValidator
  ).index("by_assignmentId_and_studentId", ["assignmentId", "studentId"]),
  schoolAssessmentQuestionStats: defineTable(
    schoolAssessmentQuestionStatValidator
  ).index("by_assignmentId_and_questionId", ["assignmentId", "questionId"]),
  schoolAssessmentClassStats: defineTable(
    schoolAssessmentClassStatValidator
  ).index("by_assignmentId_and_classId", ["assignmentId", "classId"]),
  schoolAssessmentLeaderboardEntries: defineTable(
    schoolAssessmentLeaderboardEntryValidator
  )
    .index("by_assignmentId_and_rankingScope_and_rank", [
      "assignmentId",
      "rankingScope",
      "rank",
    ])
    .index("by_assignmentId_and_studentId", ["assignmentId", "studentId"]),
  schoolAssessmentImportJobs: defineTable(schoolAssessmentImportJobValidator)
    .index("by_schoolId_and_status", ["schoolId", "status"])
    .index("by_createdBy_and_status", ["createdBy", "status"]),
  schoolAssessmentImportDrafts: defineTable(
    schoolAssessmentImportDraftValidator
  ).index("by_importJobId", ["importJobId"]),
};

export default schema;
