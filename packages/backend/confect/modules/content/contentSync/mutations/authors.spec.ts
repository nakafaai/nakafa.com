import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const contentSyncMutationsAuthorsGroup = GroupSpec.make("authors")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "bulkSyncAuthors",
      args: Schema.Struct({ authorNames: Schema.Array(Schema.String) }),
      returns: Schema.Struct({
        created: Schema.Number,
        existing: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteUnusedAuthors",
      args: Schema.Struct({
        authorIds: Schema.Array(GenericId.GenericId("authors")),
      }),
      returns: Schema.Struct({ deleted: Schema.Number }),
    })
  );

export { contentSyncMutationsAuthorsGroup };
