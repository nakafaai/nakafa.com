import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
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
          description: Schema.optional(
            Schema.Struct({
              format: Schema.Literal("plate-v1"),
              json: Schema.String,
              text: Schema.String,
            })
          ),
          mode: Schema.Literal(
            "practice",
            "assignment",
            "quiz",
            "exam",
            "tryout"
          ),
          order: Schema.Number,
          publishedAt: Schema.optional(Schema.Number),
          publishedBy: Schema.optional(GenericId.GenericId("users")),
          questionBankScope: Schema.Literal("class", "school"),
          scheduledAt: Schema.optional(Schema.Number),
          scheduledJobId: Schema.optional(
            GenericId.GenericId("_scheduled_functions")
          ),
          schoolId: GenericId.GenericId("schools"),
          slug: Schema.String,
          status: Schema.Literal("draft", "scheduled", "published", "archived"),
          title: Schema.String,
          updatedAt: Schema.Number,
          updatedBy: Schema.optional(GenericId.GenericId("users")),
        }),
        choices: Schema.Array(
          Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("schoolAssessmentChoices"),
            assessmentId: GenericId.GenericId("schoolAssessments"),
            content: Schema.Struct({
              format: Schema.Literal("plate-v1"),
              json: Schema.String,
              text: Schema.String,
            }),
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
            description: Schema.optional(
              Schema.Struct({
                format: Schema.Literal("plate-v1"),
                json: Schema.String,
                text: Schema.String,
              })
            ),
            gradingMode: Schema.Literal("auto", "manual", "hybrid"),
            instructions: Schema.optional(
              Schema.Struct({
                format: Schema.Literal("plate-v1"),
                json: Schema.String,
                text: Schema.String,
              })
            ),
            mode: Schema.Literal(
              "practice",
              "assignment",
              "quiz",
              "exam",
              "tryout"
            ),
            monitoringMode: Schema.Literal("off", "basic", "strict"),
            rankingScope: Schema.Literal("none", "class", "school"),
            releaseMode: Schema.Literal("instant", "manual", "scheduled"),
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
            explanation: Schema.optional(
              Schema.Struct({
                format: Schema.Literal("plate-v1"),
                json: Schema.String,
                text: Schema.String,
              })
            ),
            maxSelectionCount: Schema.optional(Schema.Number),
            order: Schema.Number,
            points: Schema.Number,
            questionType: Schema.Literal("mcq-single", "mcq-multi", "essay"),
            required: Schema.Boolean,
            rubricCriterionCount: Schema.Number,
            schoolId: GenericId.GenericId("schools"),
            sectionId: GenericId.GenericId("schoolAssessmentSections"),
            shuffleChoices: Schema.Boolean,
            source: Schema.Literal("manual", "bank", "ai-import"),
            stem: Schema.Struct({
              format: Schema.Literal("plate-v1"),
              json: Schema.String,
              text: Schema.String,
            }),
          })
        ),
        rubricCriteria: Schema.Array(
          Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("schoolAssessmentRubricCriteria"),
            assessmentId: GenericId.GenericId("schoolAssessments"),
            description: Schema.optional(
              Schema.Struct({
                format: Schema.Literal("plate-v1"),
                json: Schema.String,
                text: Schema.String,
              })
            ),
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
            description: Schema.optional(
              Schema.Struct({
                format: Schema.Literal("plate-v1"),
                json: Schema.String,
                text: Schema.String,
              })
            ),
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
