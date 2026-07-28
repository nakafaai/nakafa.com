import { paginationResultValidator } from "convex/server";
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
export type AssessmentStatus = Infer<typeof assessmentStatusValidator>;

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
  order: v.number(),
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

/** Public list validator for authored assessments. */
export const paginatedSchoolAssessmentsValidator = paginationResultValidator(
  schoolAssessmentDocValidator
);
