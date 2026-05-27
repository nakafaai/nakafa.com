import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const tryoutsQueriesMePartGroup = GroupSpec.make("part").addFunction(
  FunctionSpec.publicQuery({
    name: "getUserTryoutPartAttempt",
    args: Schema.Struct({
      attemptId: Schema.optional(Schema.String),
      locale: Schema.Literal("en", "id"),
      partKey: Schema.String,
      product: Schema.Literal("snbt"),
      tryoutSlug: Schema.String,
    }),
    returns: Schema.Union(
      Schema.Null,
      Schema.Struct({
        expiresAtMs: Schema.Number,
        part: Schema.Union(
          Schema.Null,
          Schema.Struct({
            currentPartKey: Schema.String,
            material: Schema.Literal(
              "mathematics",
              "quantitative-knowledge",
              "mathematical-reasoning",
              "general-reasoning",
              "indonesian-language",
              "english-language",
              "general-knowledge",
              "reading-and-writing-skills"
            ),
            questionCount: Schema.Number,
            setSlug: Schema.String,
          })
        ),
        partAttempt: Schema.Union(
          Schema.Null,
          Schema.Struct({
            answers: Schema.Array(
              Schema.Struct({
                _creationTime: Schema.Number,
                _id: GenericId.GenericId("exerciseAnswers"),
                answeredAt: Schema.Number,
                attemptId: GenericId.GenericId("exerciseAttempts"),
                exerciseNumber: Schema.Number,
                isCorrect: Schema.Boolean,
                questionId: Schema.optional(
                  GenericId.GenericId("exerciseQuestions")
                ),
                selectedOptionId: Schema.optional(Schema.String),
                textAnswer: Schema.optional(Schema.String),
                timeSpent: Schema.Number,
                updatedAt: Schema.Number,
              })
            ),
            partIndex: Schema.Number,
            partKey: Schema.String,
            setAttempt: Schema.Struct({
              _creationTime: Schema.Number,
              _id: GenericId.GenericId("exerciseAttempts"),
              answeredCount: Schema.Number,
              completedAt: Schema.Union(Schema.Number, Schema.Null),
              correctAnswers: Schema.Number,
              endReason: Schema.Union(
                Schema.Literal("submitted", "time-expired"),
                Schema.Null
              ),
              exerciseNumber: Schema.optional(Schema.Number),
              lastActivityAt: Schema.Number,
              mode: Schema.Literal("practice", "simulation"),
              origin: Schema.Literal("standalone", "tryout"),
              perQuestionTimeLimit: Schema.optional(Schema.Number),
              schedulerId: Schema.optional(
                GenericId.GenericId("_scheduled_functions")
              ),
              scope: Schema.Literal("set", "single"),
              scorePercentage: Schema.Number,
              slug: Schema.String,
              startedAt: Schema.Number,
              status: Schema.Literal("in-progress", "completed", "expired"),
              timeLimit: Schema.Number,
              totalExercises: Schema.Number,
              totalTime: Schema.Number,
              updatedAt: Schema.Number,
              userId: GenericId.GenericId("users"),
            }),
          })
        ),
        partScore: Schema.Union(
          Schema.Null,
          Schema.Struct({
            correctAnswers: Schema.Number,
            irtScore: Schema.Number,
            theta: Schema.Number,
            thetaSE: Schema.Number,
          })
        ),
        tryoutAttempt: Schema.Struct({
          _creationTime: Schema.Number,
          _id: GenericId.GenericId("tryoutAttempts"),
          accessCampaignId: Schema.optional(
            GenericId.GenericId("tryoutAccessCampaigns")
          ),
          accessCampaignKind: Schema.optional(
            Schema.Literal("competition", "access-pass")
          ),
          accessEndsAt: Schema.optional(Schema.Number),
          accessGrantId: Schema.optional(
            GenericId.GenericId("tryoutAccessGrants")
          ),
          accessKind: Schema.optional(Schema.Literal("event", "subscription")),
          attemptNumber: Schema.Number,
          completedAt: Schema.Union(Schema.Number, Schema.Null),
          completedPartIndices: Schema.Array(Schema.Number),
          countsForCompetition: Schema.optional(Schema.Boolean),
          endReason: Schema.Union(
            Schema.Literal("submitted", "time-expired"),
            Schema.Null
          ),
          expiresAt: Schema.Number,
          irtScore: Schema.Number,
          lastActivityAt: Schema.Number,
          partSetSnapshots: Schema.Array(
            Schema.Struct({
              partIndex: Schema.Number,
              partKey: Schema.String,
              questionCount: Schema.Number,
              setId: GenericId.GenericId("exerciseSets"),
            })
          ),
          publicResultStatus: Schema.Literal(
            "estimated",
            "verified-irt",
            "final-event"
          ),
          scaleVersionId: GenericId.GenericId("irtScaleVersions"),
          scoreStatus: Schema.Literal("provisional", "official"),
          startedAt: Schema.Number,
          status: Schema.Literal("in-progress", "completed", "expired"),
          theta: Schema.Number,
          thetaSE: Schema.Number,
          totalCorrect: Schema.Number,
          totalQuestions: Schema.Number,
          tryoutId: GenericId.GenericId("tryouts"),
          userId: GenericId.GenericId("users"),
        }),
      })
    ),
  })
);

export { tryoutsQueriesMePartGroup };
