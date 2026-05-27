import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const contentSyncQueriesStaleGroup = GroupSpec.make("stale").addFunction(
  FunctionSpec.internalQuery({
    name: "listStaleContentPage",
    args: Schema.Struct({
      paginationOpts: Schema.Struct({
        cursor: Schema.Union(Schema.String, Schema.Null),
        endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
        id: Schema.optional(Schema.Number),
        maximumBytesRead: Schema.optional(Schema.Number),
        maximumRowsRead: Schema.optional(Schema.Number),
        numItems: Schema.Number,
      }),
      tableName: Schema.Literal(
        "articleContents",
        "subjectTopics",
        "subjectSections",
        "exerciseSets",
        "exerciseQuestions"
      ),
    }),
    returns: Schema.Struct({
      continueCursor: Schema.String,
      isDone: Schema.Boolean,
      page: Schema.Array(
        Schema.Struct({
          id: Schema.Union(
            GenericId.GenericId("articleContents"),
            GenericId.GenericId("subjectTopics"),
            GenericId.GenericId("subjectSections"),
            GenericId.GenericId("exerciseSets"),
            GenericId.GenericId("exerciseQuestions")
          ),
          locale: Schema.Literal("en", "id"),
          slug: Schema.String,
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

export { contentSyncQueriesStaleGroup };
