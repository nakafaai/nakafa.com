import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import {
  assessmentImportJobStatusSchema,
  assessmentQuestionTypeSchema,
  richContentSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

/** AI import workflow job row. */
export const schoolAssessmentImportJobSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: Schema.optional(GenericId.GenericId("schoolClasses")),
  assessmentId: Schema.optional(GenericId.GenericId("schoolAssessments")),
  status: assessmentImportJobStatusSchema,
  sourceName: Schema.String,
  sourceStorageId: Schema.optional(GenericId.GenericId("_storage")),
  createdBy: GenericId.GenericId("users"),
  updatedAt: Schema.Number,
  errorMessage: Schema.optional(Schema.String),
});

/** Draft questions produced by AI import before teacher review. */
export const schoolAssessmentImportDraftSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  classId: Schema.optional(GenericId.GenericId("schoolClasses")),
  importJobId: GenericId.GenericId("schoolAssessmentImportJobs"),
  questionType: assessmentQuestionTypeSchema,
  stem: richContentSchema,
  explanation: Schema.optional(richContentSchema),
  points: Schema.Number,
  choiceDrafts: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      content: richContentSchema,
      isCorrect: Schema.Boolean,
    })
  ),
  rubricDrafts: Schema.Array(
    Schema.Struct({
      label: Schema.String,
      description: Schema.optional(richContentSchema),
      maxScore: Schema.Number,
    })
  ),
  importedAt: Schema.Number,
});

/** schoolAssessmentImportJobs table definition. */
export const SchoolAssessmentImportJobs = Table.make(
  "schoolAssessmentImportJobs",
  schoolAssessmentImportJobSchema
)
  .index("by_schoolId_and_status", ["schoolId", "status"])
  .index("by_createdBy_and_status", ["createdBy", "status"]);

/** schoolAssessmentImportDrafts table definition. */
export const SchoolAssessmentImportDrafts = Table.make(
  "schoolAssessmentImportDrafts",
  schoolAssessmentImportDraftSchema
).index("by_importJobId", ["importJobId"]);
