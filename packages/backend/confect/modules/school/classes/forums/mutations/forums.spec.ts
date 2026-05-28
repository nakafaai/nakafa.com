import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { schoolClassForumTagSchema } from "@repo/backend/confect/modules/school/classes.tables";
import { Schema } from "effect";

const classesForumsMutationsForumsGroup = GroupSpec.make("forums").addFunction(
  FunctionSpec.publicMutation({
    name: "createForum",
    args: Schema.Struct({
      body: Schema.String,
      classId: GenericId.GenericId("schoolClasses"),
      tag: schoolClassForumTagSchema,
      title: Schema.String,
    }),
    returns: GenericId.GenericId("schoolClassForums"),
  })
);

export { classesForumsMutationsForumsGroup };
