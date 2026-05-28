import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { tryoutProductSchema } from "@repo/backend/confect/modules/tryout/products";
import {
  tryoutPublicResultStatusSchema,
  tryoutScoreStatusSchema,
  tryoutStatusSchema,
} from "@repo/backend/confect/modules/tryout/tryouts.tables";
import { Schema } from "effect";

const tryoutsQueriesMeHistoryGroup = GroupSpec.make("history").addFunction(
  FunctionSpec.publicQuery({
    name: "getUserTryoutAttemptHistory",
    args: Schema.Struct({
      attemptId: Schema.optional(Schema.String),
      locale: localeSchema,
      paginationOpts: Schema.Struct({
        cursor: Schema.Union(Schema.String, Schema.Null),
        endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
        id: Schema.optional(Schema.Number),
        maximumBytesRead: Schema.optional(Schema.Number),
        maximumRowsRead: Schema.optional(Schema.Number),
        numItems: Schema.Number,
      }),
      product: tryoutProductSchema,
      tryoutSlug: Schema.String,
    }),
    returns: Schema.Struct({
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
      splitCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
    }),
  })
);

export { tryoutsQueriesMeHistoryGroup };
