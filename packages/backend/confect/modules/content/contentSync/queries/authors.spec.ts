import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const contentSyncQueriesAuthorsGroup = GroupSpec.make("authors").addFunction(
  FunctionSpec.internalQuery({
    name: "listAuthorsPage",
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
          id: GenericId.GenericId("authors"),
          name: Schema.String,
          username: Schema.String,
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

export { contentSyncQueriesAuthorsGroup };
