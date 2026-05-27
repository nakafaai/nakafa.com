import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const tryoutsQueriesTryoutsGroup = GroupSpec.make("tryouts")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getActiveTryoutCatalogPage",
      args: Schema.Struct({
        locale: Schema.Literal("en", "id"),
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
        product: Schema.Literal("snbt"),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        page: Schema.Array(
          Schema.Struct({
            cycleKey: Schema.String,
            label: Schema.String,
            latestAttempt: Schema.Union(
              Schema.Struct({
                expiresAtMs: Schema.Number,
                status: Schema.Literal("in-progress", "completed", "expired"),
                updatedAt: Schema.Number,
              }),
              Schema.Null
            ),
            partCount: Schema.Number,
            slug: Schema.String,
            totalQuestionCount: Schema.Number,
            tryoutId: GenericId.GenericId("tryouts"),
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
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getActiveTryoutCatalogSnapshot",
      args: Schema.Struct({
        locale: Schema.Literal("en", "id"),
        pageSize: Schema.optional(Schema.Number),
        product: Schema.Literal("snbt"),
      }),
      returns: Schema.Struct({
        activeCount: Schema.Number,
        initialPage: Schema.Array(
          Schema.Struct({
            cycleKey: Schema.String,
            label: Schema.String,
            latestAttempt: Schema.Union(
              Schema.Struct({
                expiresAtMs: Schema.Number,
                status: Schema.Literal("in-progress", "completed", "expired"),
                updatedAt: Schema.Number,
              }),
              Schema.Null
            ),
            partCount: Schema.Number,
            slug: Schema.String,
            totalQuestionCount: Schema.Number,
            tryoutId: GenericId.GenericId("tryouts"),
          })
        ),
      }),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getTryoutDetails",
      args: Schema.Struct({
        locale: Schema.Literal("en", "id"),
        product: Schema.Literal("snbt"),
        slug: Schema.String,
      }),
      returns: Schema.Union(
        Schema.Struct({
          parts: Schema.Array(
            Schema.Struct({
              material: Schema.String,
              partIndex: Schema.Number,
              partKey: Schema.String,
              questionCount: Schema.Number,
              setId: GenericId.GenericId("exerciseSets"),
              setSlug: Schema.String,
            })
          ),
          tryout: Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("tryouts"),
            catalogPosition: Schema.Number,
            cycleKey: Schema.String,
            detectedAt: Schema.Number,
            isActive: Schema.Boolean,
            label: Schema.String,
            locale: Schema.Literal("en", "id"),
            partCount: Schema.Number,
            product: Schema.Literal("snbt"),
            slug: Schema.String,
            syncedAt: Schema.Number,
            totalQuestionCount: Schema.Number,
          }),
        }),
        Schema.Null
      ),
    })
  );

export { tryoutsQueriesTryoutsGroup };
