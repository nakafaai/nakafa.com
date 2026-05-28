import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  assessmentGradingModeSchema,
  assessmentModeSchema,
  assessmentMonitoringModeSchema,
  assessmentQuestionBankScopeSchema,
  assessmentQuestionSourceSchema,
  assessmentQuestionTypeSchema,
  assessmentRankingScopeSchema,
  assessmentReleaseModeSchema,
  assessmentStatusSchema,
  richContentSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

const assessmentsQueriesPublicAuthoringGroup = GroupSpec.make(
  "authoring"
).addFunction(
  FunctionSpec.publicQuery({
    name: "getAuthoredAssessment",
    args: Schema.Struct({
      assessmentId: GenericId.GenericId("schoolAssessments"),
      schoolId: GenericId.GenericId("schools"),
    }),
    returns: Schema.Union(
      Schema.Struct({
        assessment: Schema.Struct({
          _creationTime: Schema.Number,
          _id: GenericId.GenericId("schoolAssessments"),
          archivedAt: Schema.optional(Schema.Number),
          archivedBy: Schema.optional(GenericId.GenericId("users")),
          classId: Schema.optional(GenericId.GenericId("schoolClasses")),
          createdBy: GenericId.GenericId("users"),
          currentVersionId: Schema.optional(
            GenericId.GenericId("schoolAssessmentVersions")
          ),
          description: Schema.optional(richContentSchema),
          mode: assessmentModeSchema,
          order: Schema.Number,
          publishedAt: Schema.optional(Schema.Number),
          publishedBy: Schema.optional(GenericId.GenericId("users")),
          questionBankScope: assessmentQuestionBankScopeSchema,
          scheduledAt: Schema.optional(Schema.Number),
          scheduledJobId: Schema.optional(
            GenericId.GenericId("_scheduled_functions")
          ),
          schoolId: GenericId.GenericId("schools"),
          slug: Schema.String,
          status: assessmentStatusSchema,
          title: Schema.String,
          updatedAt: Schema.Number,
          updatedBy: Schema.optional(GenericId.GenericId("users")),
        }),
        choices: Schema.Array(
          Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("schoolAssessmentChoices"),
            assessmentId: GenericId.GenericId("schoolAssessments"),
            content: richContentSchema,
            isCorrect: Schema.Boolean,
            key: Schema.String,
            order: Schema.Number,
            questionId: GenericId.GenericId("schoolAssessmentQuestions"),
            schoolId: GenericId.GenericId("schools"),
          })
        ),
        currentVersion: Schema.Union(
          Schema.Null,
          Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("schoolAssessmentVersions"),
            assessmentId: GenericId.GenericId("schoolAssessments"),
            createdAt: Schema.Number,
            createdBy: GenericId.GenericId("users"),
            description: Schema.optional(richContentSchema),
            gradingMode: assessmentGradingModeSchema,
            instructions: Schema.optional(richContentSchema),
            mode: assessmentModeSchema,
            monitoringMode: assessmentMonitoringModeSchema,
            rankingScope: assessmentRankingScopeSchema,
            releaseMode: assessmentReleaseModeSchema,
            retakePolicy: Schema.Struct({
              allowRetake: Schema.Boolean,
              maxAttempts: Schema.optional(Schema.Number),
            }),
            schoolId: GenericId.GenericId("schools"),
            timingPolicy: Schema.Struct({
              durationMinutes: Schema.optional(Schema.Number),
              perSection: Schema.Boolean,
            }),
            title: Schema.String,
            totalPoints: Schema.Number,
            totalQuestionCount: Schema.Number,
            versionNumber: Schema.Number,
          })
        ),
        questions: Schema.Array(
          Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("schoolAssessmentQuestions"),
            assessmentId: GenericId.GenericId("schoolAssessments"),
            bankEntryId: Schema.optional(
              GenericId.GenericId("schoolAssessmentQuestionBankEntries")
            ),
            choiceCount: Schema.Number,
            explanation: Schema.optional(richContentSchema),
            maxSelectionCount: Schema.optional(Schema.Number),
            order: Schema.Number,
            points: Schema.Number,
            questionType: assessmentQuestionTypeSchema,
            required: Schema.Boolean,
            rubricCriterionCount: Schema.Number,
            schoolId: GenericId.GenericId("schools"),
            sectionId: GenericId.GenericId("schoolAssessmentSections"),
            shuffleChoices: Schema.Boolean,
            source: assessmentQuestionSourceSchema,
            stem: richContentSchema,
          })
        ),
        rubricCriteria: Schema.Array(
          Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("schoolAssessmentRubricCriteria"),
            assessmentId: GenericId.GenericId("schoolAssessments"),
            description: Schema.optional(richContentSchema),
            label: Schema.String,
            maxScore: Schema.Number,
            order: Schema.Number,
            questionId: GenericId.GenericId("schoolAssessmentQuestions"),
            schoolId: GenericId.GenericId("schools"),
          })
        ),
        sections: Schema.Array(
          Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("schoolAssessmentSections"),
            assessmentId: GenericId.GenericId("schoolAssessments"),
            description: Schema.optional(richContentSchema),
            durationMinutes: Schema.optional(Schema.Number),
            order: Schema.Number,
            schoolId: GenericId.GenericId("schools"),
            title: Schema.String,
          })
        ),
      }),
      Schema.Null
    ),
  })
);

export { assessmentsQueriesPublicAuthoringGroup };
