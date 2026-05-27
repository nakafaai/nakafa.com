import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const classesForumsMutationsReactionsGroup = GroupSpec.make("reactions")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "toggleForumReaction",
      args: Schema.Struct({
        emoji: Schema.String,
        forumId: GenericId.GenericId("schoolClassForums"),
      }),
      returns: Schema.Struct({ added: Schema.Boolean }),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "togglePostReaction",
      args: Schema.Struct({
        emoji: Schema.String,
        postId: GenericId.GenericId("schoolClassForumPosts"),
      }),
      returns: Schema.Struct({ added: Schema.Boolean }),
    })
  );

export { classesForumsMutationsReactionsGroup };
