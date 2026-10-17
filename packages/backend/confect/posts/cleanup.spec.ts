import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** Removes one bounded batch of the likes of a deleted post, and schedules the next batch when some remain. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "cleanupDeletedPost",
    args: () => ({
      postId: IdSchema("posts"),
    }),
    returns: () => Schema.Null,
  })
);
