import { FunctionSpec, GroupSpec } from "@confect/core";
import { countableTableNameSchema } from "@repo/backend/confect/modules/content/contentSync.shared";
import { Schema } from "effect";

const contentSyncQueriesCountsGroup = GroupSpec.make("counts").addFunction(
  FunctionSpec.internalQuery({
    name: "countTablePage",
    args: Schema.Struct({
      paginationOpts: Schema.Struct({
        cursor: Schema.Union(Schema.String, Schema.Null),
        endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
        id: Schema.optional(Schema.Number),
        maximumBytesRead: Schema.optional(Schema.Number),
        maximumRowsRead: Schema.optional(Schema.Number),
        numItems: Schema.Number,
      }),
      tableName: countableTableNameSchema,
    }),
    returns: Schema.Struct({
      continueCursor: Schema.String,
      isDone: Schema.Boolean,
      pageSize: Schema.Number,
    }),
  })
);

export { contentSyncQueriesCountsGroup };
