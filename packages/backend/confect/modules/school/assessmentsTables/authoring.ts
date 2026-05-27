import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import {
  assessmentGradingModeSchema,
  assessmentModeSchema,
  assessmentMonitoringModeSchema,
  assessmentQuestionBankScopeSchema,
  assessmentQuestionSourceSchema,
  assessmentQuestionTypeSchema,
  assessmentRankingScopeSchema,
  assessmentReleaseModeSchema,
  assessmentRetakePolicySchema,
  assessmentStatusSchema,
  assessmentTimingPolicySchema,
  richContentSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

/** Assessment-level authored document. */
export const schoolAssessmentSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: Schema.optional(GenericId.GenericId("schoolClasses")),
  title: Schema.String,
  slug: Schema.String,
  order: Schema.Number,
  description: Schema.optional(richContentSchema),
  mode: assessmentModeSchema,
  status: assessmentStatusSchema,
  currentVersionId: Schema.optional(
    GenericId.GenericId("schoolAssessmentVersions")
  ),
  questionBankScope: assessmentQuestionBankScopeSchema,
  createdBy: GenericId.GenericId("users"),
  updatedBy: Schema.optional(GenericId.GenericId("users")),
  archivedBy: Schema.optional(GenericId.GenericId("users")),
  scheduledAt: Schema.optional(Schema.Number),
  scheduledJobId: Schema.optional(GenericId.GenericId("_scheduled_functions")),
  publishedAt: Schema.optional(Schema.Number),
  publishedBy: Schema.optional(GenericId.GenericId("users")),
  updatedAt: Schema.Number,
  archivedAt: Schema.optional(Schema.Number),
});

/** Immutable version snapshot metadata. */
export const schoolAssessmentVersionSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  assessmentId: GenericId.GenericId("schoolAssessments"),
  versionNumber: Schema.Number,
  title: Schema.String,
  description: Schema.optional(richContentSchema),
  mode: assessmentModeSchema,
  instructions: Schema.optional(richContentSchema),
  timingPolicy: assessmentTimingPolicySchema,
  gradingMode: assessmentGradingModeSchema,
  monitoringMode: assessmentMonitoringModeSchema,
  releaseMode: assessmentReleaseModeSchema,
  rankingScope: assessmentRankingScopeSchema,
  retakePolicy: assessmentRetakePolicySchema,
  totalPoints: Schema.Number,
  totalQuestionCount: Schema.Number,
  createdBy: GenericId.GenericId("users"),
  createdAt: Schema.Number,
});

/** Authored section row attached to one assessment draft. */
export const schoolAssessmentSectionSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  assessmentId: GenericId.GenericId("schoolAssessments"),
  title: Schema.String,
  description: Schema.optional(richContentSchema),
  order: Schema.Number,
  durationMinutes: Schema.optional(Schema.Number),
});

/** Immutable section snapshot row frozen into one version. */
export const schoolAssessmentVersionSectionSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  assessmentId: GenericId.GenericId("schoolAssessments"),
  versionId: GenericId.GenericId("schoolAssessmentVersions"),
  sourceSectionId: GenericId.GenericId("schoolAssessmentSections"),
  title: Schema.String,
  description: Schema.optional(richContentSchema),
  order: Schema.Number,
  durationMinutes: Schema.optional(Schema.Number),
  questionCount: Schema.Number,
  totalPoints: Schema.Number,
});

/** Authored question row tied to one assessment draft. */
export const schoolAssessmentQuestionSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  assessmentId: GenericId.GenericId("schoolAssessments"),
  sectionId: GenericId.GenericId("schoolAssessmentSections"),
  questionType: assessmentQuestionTypeSchema,
  source: assessmentQuestionSourceSchema,
  stem: richContentSchema,
  explanation: Schema.optional(richContentSchema),
  order: Schema.Number,
  points: Schema.Number,
  required: Schema.Boolean,
  shuffleChoices: Schema.Boolean,
  maxSelectionCount: Schema.optional(Schema.Number),
  rubricCriterionCount: Schema.Number,
  choiceCount: Schema.Number,
  bankEntryId: Schema.optional(
    GenericId.GenericId("schoolAssessmentQuestionBankEntries")
  ),
});

/** Immutable question snapshot row frozen into one version. */
export const schoolAssessmentVersionQuestionSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  assessmentId: GenericId.GenericId("schoolAssessments"),
  versionId: GenericId.GenericId("schoolAssessmentVersions"),
  sourceQuestionId: GenericId.GenericId("schoolAssessmentQuestions"),
  sectionId: GenericId.GenericId("schoolAssessmentVersionSections"),
  questionType: assessmentQuestionTypeSchema,
  source: assessmentQuestionSourceSchema,
  stem: richContentSchema,
  explanation: Schema.optional(richContentSchema),
  order: Schema.Number,
  points: Schema.Number,
  required: Schema.Boolean,
  shuffleChoices: Schema.Boolean,
  maxSelectionCount: Schema.optional(Schema.Number),
  rubricCriterionCount: Schema.Number,
  choiceCount: Schema.Number,
  bankEntryId: Schema.optional(
    GenericId.GenericId("schoolAssessmentQuestionBankEntries")
  ),
});

/** Multiple choice option row on the authored draft. */
export const schoolAssessmentChoiceSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  assessmentId: GenericId.GenericId("schoolAssessments"),
  questionId: GenericId.GenericId("schoolAssessmentQuestions"),
  key: Schema.String,
  content: richContentSchema,
  order: Schema.Number,
  isCorrect: Schema.Boolean,
});

/** Multiple choice option row frozen into one version. */
export const schoolAssessmentVersionChoiceSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  assessmentId: GenericId.GenericId("schoolAssessments"),
  versionId: GenericId.GenericId("schoolAssessmentVersions"),
  questionId: GenericId.GenericId("schoolAssessmentVersionQuestions"),
  sourceChoiceId: GenericId.GenericId("schoolAssessmentChoices"),
  key: Schema.String,
  content: richContentSchema,
  order: Schema.Number,
  isCorrect: Schema.Boolean,
});

/** Essay rubric criterion row on the authored draft. */
export const schoolAssessmentRubricCriterionSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  assessmentId: GenericId.GenericId("schoolAssessments"),
  questionId: GenericId.GenericId("schoolAssessmentQuestions"),
  label: Schema.String,
  description: Schema.optional(richContentSchema),
  maxScore: Schema.Number,
  order: Schema.Number,
});

/** Essay rubric criterion row frozen into one version. */
export const schoolAssessmentVersionRubricCriterionSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  assessmentId: GenericId.GenericId("schoolAssessments"),
  versionId: GenericId.GenericId("schoolAssessmentVersions"),
  questionId: GenericId.GenericId("schoolAssessmentVersionQuestions"),
  sourceCriterionId: GenericId.GenericId("schoolAssessmentRubricCriteria"),
  label: Schema.String,
  description: Schema.optional(richContentSchema),
  maxScore: Schema.Number,
  order: Schema.Number,
});

/** Reusable question bank. */
export const schoolAssessmentQuestionBankSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: Schema.optional(GenericId.GenericId("schoolClasses")),
  scope: assessmentQuestionBankScopeSchema,
  title: Schema.String,
  description: Schema.optional(richContentSchema),
  createdBy: GenericId.GenericId("users"),
  updatedBy: Schema.optional(GenericId.GenericId("users")),
  updatedAt: Schema.Number,
});

/** Question bank entry snapshot. */
export const schoolAssessmentQuestionBankEntrySchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: Schema.optional(GenericId.GenericId("schoolClasses")),
  bankId: GenericId.GenericId("schoolAssessmentQuestionBanks"),
  questionType: assessmentQuestionTypeSchema,
  stem: richContentSchema,
  explanation: Schema.optional(richContentSchema),
  points: Schema.Number,
  shuffleChoices: Schema.Boolean,
  maxSelectionCount: Schema.optional(Schema.Number),
  source: assessmentQuestionSourceSchema,
  createdBy: GenericId.GenericId("users"),
  updatedBy: Schema.optional(GenericId.GenericId("users")),
  updatedAt: Schema.Number,
});

/** schoolAssessments table definition. */
export const SchoolAssessments = Table.make(
  "schoolAssessments",
  schoolAssessmentSchema
)
  .index("by_schoolId_and_status", ["schoolId", "status"])
  .index("by_schoolId_and_slug", ["schoolId", "slug"])
  .index("by_schoolId_and_classId_and_status", [
    "schoolId",
    "classId",
    "status",
  ])
  .index("by_schoolId_and_classId_and_status_and_order", [
    "schoolId",
    "classId",
    "status",
    "order",
  ])
  .index("by_schoolId_and_classId_and_order", ["schoolId", "classId", "order"])
  .index("by_schoolId_and_order", ["schoolId", "order"])
  .index("by_schoolId_and_updatedAt", ["schoolId", "updatedAt"])
  .index("by_schoolId_and_classId_and_updatedAt", [
    "schoolId",
    "classId",
    "updatedAt",
  ]);

/** schoolAssessmentVersions table definition. */
export const SchoolAssessmentVersions = Table.make(
  "schoolAssessmentVersions",
  schoolAssessmentVersionSchema
).index("by_assessmentId_and_versionNumber", ["assessmentId", "versionNumber"]);

/** schoolAssessmentSections table definition. */
export const SchoolAssessmentSections = Table.make(
  "schoolAssessmentSections",
  schoolAssessmentSectionSchema
).index("by_assessmentId_and_order", ["assessmentId", "order"]);

/** schoolAssessmentVersionSections table definition. */
export const SchoolAssessmentVersionSections = Table.make(
  "schoolAssessmentVersionSections",
  schoolAssessmentVersionSectionSchema
)
  .index("by_versionId_and_order", ["versionId", "order"])
  .index("by_assessmentId_and_versionId_and_order", [
    "assessmentId",
    "versionId",
    "order",
  ]);

/** schoolAssessmentQuestions table definition. */
export const SchoolAssessmentQuestions = Table.make(
  "schoolAssessmentQuestions",
  schoolAssessmentQuestionSchema
)
  .index("by_assessmentId_and_sectionId_and_order", [
    "assessmentId",
    "sectionId",
    "order",
  ])
  .index("by_bankEntryId", ["bankEntryId"]);

/** schoolAssessmentVersionQuestions table definition. */
export const SchoolAssessmentVersionQuestions = Table.make(
  "schoolAssessmentVersionQuestions",
  schoolAssessmentVersionQuestionSchema
)
  .index("by_versionId_and_sectionId_and_order", [
    "versionId",
    "sectionId",
    "order",
  ])
  .index("by_assessmentId_and_versionId_and_sectionId_and_order", [
    "assessmentId",
    "versionId",
    "sectionId",
    "order",
  ])
  .index("by_sourceQuestionId", ["sourceQuestionId"]);

/** schoolAssessmentChoices table definition. */
export const SchoolAssessmentChoices = Table.make(
  "schoolAssessmentChoices",
  schoolAssessmentChoiceSchema
)
  .index("by_questionId_and_order", ["questionId", "order"])
  .index("by_assessmentId_and_questionId_and_order", [
    "assessmentId",
    "questionId",
    "order",
  ]);

/** schoolAssessmentVersionChoices table definition. */
export const SchoolAssessmentVersionChoices = Table.make(
  "schoolAssessmentVersionChoices",
  schoolAssessmentVersionChoiceSchema
)
  .index("by_questionId_and_order", ["questionId", "order"])
  .index("by_assessmentId_and_questionId_and_order", [
    "assessmentId",
    "questionId",
    "order",
  ]);

/** schoolAssessmentRubricCriteria table definition. */
export const SchoolAssessmentRubricCriteria = Table.make(
  "schoolAssessmentRubricCriteria",
  schoolAssessmentRubricCriterionSchema
)
  .index("by_questionId_and_order", ["questionId", "order"])
  .index("by_assessmentId_and_questionId_and_order", [
    "assessmentId",
    "questionId",
    "order",
  ]);

/** schoolAssessmentVersionRubricCriteria table definition. */
export const SchoolAssessmentVersionRubricCriteria = Table.make(
  "schoolAssessmentVersionRubricCriteria",
  schoolAssessmentVersionRubricCriterionSchema
)
  .index("by_questionId_and_order", ["questionId", "order"])
  .index("by_assessmentId_and_questionId_and_order", [
    "assessmentId",
    "questionId",
    "order",
  ]);

/** schoolAssessmentQuestionBanks table definition. */
export const SchoolAssessmentQuestionBanks = Table.make(
  "schoolAssessmentQuestionBanks",
  schoolAssessmentQuestionBankSchema
)
  .index("by_schoolId_and_scope", ["schoolId", "scope"])
  .index("by_schoolId_and_classId", ["schoolId", "classId"]);

/** schoolAssessmentQuestionBankEntries table definition. */
export const SchoolAssessmentQuestionBankEntries = Table.make(
  "schoolAssessmentQuestionBankEntries",
  schoolAssessmentQuestionBankEntrySchema
)
  .index("by_bankId", ["bankId"])
  .index("by_schoolId_and_classId", ["schoolId", "classId"]);
