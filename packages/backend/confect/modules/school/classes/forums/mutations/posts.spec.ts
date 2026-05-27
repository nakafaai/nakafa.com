import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const classesForumsMutationsPostsGroup = GroupSpec.make("posts").addFunction(
  FunctionSpec.publicMutation({
    name: "createForumPost",
    args: Schema.Struct({
      attachmentUploadIds: Schema.optional(
        Schema.Array(GenericId.GenericId("schoolClassForumPendingUploads"))
      ),
      body: Schema.String,
      forumId: GenericId.GenericId("schoolClassForums"),
      mentions: Schema.optional(Schema.Array(GenericId.GenericId("users"))),
      parentId: Schema.optional(GenericId.GenericId("schoolClassForumPosts")),
    }),
    returns: GenericId.GenericId("schoolClassForumPosts"),
  })
);

export { classesForumsMutationsPostsGroup };
