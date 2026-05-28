import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { tryoutProductSchema } from "@repo/backend/confect/modules/tryout/products";
import { tryoutStatusSchema } from "@repo/backend/confect/modules/tryout/tryouts.tables";
import { Schema } from "effect";

const activeTryoutCatalogEntrySchema = Schema.Struct({
  cycleKey: Schema.String,
  label: Schema.String,
  latestAttempt: Schema.Union(
    Schema.Struct({
      expiresAtMs: Schema.Number,
      status: tryoutStatusSchema,
      updatedAt: Schema.Number,
    }),
    Schema.Null
  ),
  partCount: Schema.Number,
  slug: Schema.String,
  totalQuestionCount: Schema.Number,
  tryoutId: GenericId.GenericId("tryouts"),
});

const activeTryoutCatalogArgsSchema = Schema.Struct({
  locale: localeSchema,
  pageSize: Schema.optional(Schema.Number),
  product: tryoutProductSchema,
});

const activeTryoutCatalogSnapshotSchema = Schema.Struct({
  activeCount: Schema.Number,
  initialPage: Schema.Array(activeTryoutCatalogEntrySchema),
});

const tryoutsQueriesTryoutsGroup = GroupSpec.make("tryouts")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getActiveTryoutCatalogPage",
      args: Schema.Struct({
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
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        page: Schema.Array(activeTryoutCatalogEntrySchema),
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
      args: activeTryoutCatalogArgsSchema,
      returns: activeTryoutCatalogSnapshotSchema,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getPublicActiveTryoutCatalogSnapshot",
      args: activeTryoutCatalogArgsSchema,
      returns: activeTryoutCatalogSnapshotSchema,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getTryoutDetails",
      args: Schema.Struct({
        locale: localeSchema,
        product: tryoutProductSchema,
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
            locale: localeSchema,
            partCount: Schema.Number,
            product: tryoutProductSchema,
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
