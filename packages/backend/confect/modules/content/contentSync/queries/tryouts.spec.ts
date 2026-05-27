import { FunctionSpec, GroupSpec } from "@confect/core";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { tryoutProductSchema } from "@repo/backend/confect/modules/tryout/products";
import { Schema } from "effect";

const contentSyncQueriesTryoutsGroup = GroupSpec.make("tryouts").addFunction(
  FunctionSpec.internalQuery({
    name: "getTryoutScaleIntegrity",
    args: Schema.Struct({
      paginationOpts: Schema.Struct({
        cursor: Schema.Union(Schema.String, Schema.Null),
        endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
        id: Schema.optional(Schema.Number),
        maximumBytesRead: Schema.optional(Schema.Number),
        maximumRowsRead: Schema.optional(Schema.Number),
        numItems: Schema.Number,
      }),
    }),
    returns: Schema.Struct({
      continueCursor: Schema.String,
      isDone: Schema.Boolean,
      page: Schema.Array(
        Schema.Struct({
          cycleKey: Schema.String,
          locale: localeSchema,
          product: tryoutProductSchema,
          slug: Schema.String,
        })
      ),
    }),
  })
);

export { contentSyncQueriesTryoutsGroup };
