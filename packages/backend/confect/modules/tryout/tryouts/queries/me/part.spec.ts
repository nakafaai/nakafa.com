import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import {
  ExerciseAnswers,
  ExerciseAttempts,
} from "@repo/backend/confect/modules/learning/exercises.tables";
import { tryoutAccessCampaignKindSchema } from "@repo/backend/confect/modules/tryout/access.tables";
import { tryoutProductSchema } from "@repo/backend/confect/modules/tryout/products";
import {
  tryoutAccessKindSchema,
  tryoutPublicResultStatusSchema,
  tryoutScoreStatusSchema,
  tryoutStatusSchema,
} from "@repo/backend/confect/modules/tryout/tryouts.tables";
import { Schema } from "effect";

const tryoutsQueriesMePartGroup = GroupSpec.make("part").addFunction(
  FunctionSpec.publicQuery({
    name: "getUserTryoutPartAttempt",
    args: Schema.Struct({
      attemptId: Schema.optional(Schema.String),
      locale: localeSchema,
      partKey: Schema.String,
      product: tryoutProductSchema,
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
            answers: Schema.Array(ExerciseAnswers.Doc),
            partIndex: Schema.Number,
            partKey: Schema.String,
            setAttempt: ExerciseAttempts.Doc,
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
          accessCampaignKind: Schema.optional(tryoutAccessCampaignKindSchema),
          accessEndsAt: Schema.optional(Schema.Number),
          accessGrantId: Schema.optional(
            GenericId.GenericId("tryoutAccessGrants")
          ),
          accessKind: Schema.optional(tryoutAccessKindSchema),
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
          publicResultStatus: tryoutPublicResultStatusSchema,
          scaleVersionId: GenericId.GenericId("irtScaleVersions"),
          scoreStatus: tryoutScoreStatusSchema,
          startedAt: Schema.Number,
          status: tryoutStatusSchema,
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
