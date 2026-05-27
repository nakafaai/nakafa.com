import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const classesForumsMutationsForumsGroup = GroupSpec.make("forums").addFunction(
  FunctionSpec.publicMutation({
    name: "createForum",
    args: Schema.Struct({
      body: Schema.String,
      classId: GenericId.GenericId("schoolClasses"),
      tag: Schema.Literal(
        "general",
        "question",
        "announcement",
        "assignment",
        "resource"
      ),
      title: Schema.String,
    }),
    returns: GenericId.GenericId("schoolClassForums"),
  })
);

export { classesForumsMutationsForumsGroup };
