import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const classesForumsInternalMutationsGroup = GroupSpec.make(
  "internalMutations"
).addFunction(
  FunctionSpec.internalMutation({
    name: "deleteExpiredPendingUpload",
    args: Schema.Struct({
      uploadId: GenericId.GenericId("schoolClassForumPendingUploads"),
    }),
    returns: Schema.Null,
  })
);

export { classesForumsInternalMutationsGroup };
