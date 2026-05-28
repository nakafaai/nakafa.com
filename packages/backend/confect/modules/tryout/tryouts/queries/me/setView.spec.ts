import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { tryoutAccessCampaignKindSchema } from "@repo/backend/confect/modules/tryout/access.tables";
import { tryoutProductSchema } from "@repo/backend/confect/modules/tryout/products";
import {
  tryoutAccessKindSchema,
  tryoutPublicResultStatusSchema,
  tryoutScoreStatusSchema,
  tryoutStatusSchema,
} from "@repo/backend/confect/modules/tryout/tryouts.tables";
import { Schema } from "effect";

const tryoutsQueriesMeSetViewGroup = GroupSpec.make("setView").addFunction(
  FunctionSpec.publicQuery({
    name: "getUserTryoutSetView",
    args: Schema.Struct({
      attemptId: Schema.optional(Schema.String),
      locale: localeSchema,
      product: tryoutProductSchema,
      tryoutSlug: Schema.String,
    }),
    returns: Schema.Union(
      Schema.Null,
      Schema.Struct({
        attemptData: Schema.Struct({
          attempt: Schema.Struct({
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
          expiresAtMs: Schema.Number,
          orderedParts: Schema.Array(
            Schema.Struct({ partIndex: Schema.Number, partKey: Schema.String })
          ),
          partAttempts: Schema.Array(
            Schema.Struct({
              partIndex: Schema.Number,
              partKey: Schema.String,
              score: Schema.Union(
                Schema.Null,
                Schema.Struct({
                  correctAnswers: Schema.Number,
                  irtScore: Schema.Number,
                  theta: Schema.Number,
                  thetaSE: Schema.Number,
                })
              ),
              setAttempt: Schema.Union(
                Schema.Null,
                Schema.Struct({
                  lastActivityAt: Schema.Number,
                  startedAt: Schema.Number,
                  status: tryoutStatusSchema,
                  timeLimit: Schema.Number,
                })
              ),
            })
          ),
          resumePartKey: Schema.optional(Schema.String),
        }),
        initialHistory: Schema.Struct({
          continueCursor: Schema.String,
          isDone: Schema.Boolean,
          page: Schema.Array(
            Schema.Struct({
              attemptId: GenericId.GenericId("tryoutAttempts"),
              attemptNumber: Schema.Number,
              completedAt: Schema.Union(Schema.Number, Schema.Null),
              countsForCompetition: Schema.Boolean,
              expiresAt: Schema.Number,
              irtScore: Schema.Number,
              isLatest: Schema.Boolean,
              publicResultStatus: tryoutPublicResultStatusSchema,
              scoreStatus: tryoutScoreStatusSchema,
              startedAt: Schema.Number,
              status: tryoutStatusSchema,
              totalCorrect: Schema.Number,
              totalQuestions: Schema.Number,
            })
          ),
          pageStatus: Schema.optional(
            Schema.Union(
              Schema.Literal("SplitRecommended"),
              Schema.Literal("SplitRequired"),
              Schema.Null
            )
          ),
          splitCursor: Schema.optional(
            Schema.Union(Schema.String, Schema.Null)
          ),
        }),
      })
    ),
  })
);

export { tryoutsQueriesMeSetViewGroup };
