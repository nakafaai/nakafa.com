import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const classesForumsMutationsReadStateGroup = GroupSpec.make(
  "readState"
).addFunction(
  FunctionSpec.publicMutation({
    name: "markForumRead",
    args: Schema.Struct({
      forumId: GenericId.GenericId("schoolClassForums"),
      lastReadPostId: GenericId.GenericId("schoolClassForumPosts"),
    }),
    returns: Schema.Null,
  })
);

export { classesForumsMutationsReadStateGroup };
