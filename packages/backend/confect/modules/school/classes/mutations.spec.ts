import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  schoolClassImageSchema,
  schoolClassVisibilitySchema,
} from "@repo/backend/confect/modules/school/classes.tables";
import { Schema } from "effect";

const classesMutationsGroup = GroupSpec.make("mutations")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createClass",
      args: Schema.Struct({
        name: Schema.String,
        schoolId: GenericId.GenericId("schools"),
        subject: Schema.String,
        visibility: schoolClassVisibilitySchema,
        year: Schema.String,
      }),
      returns: GenericId.GenericId("schoolClasses"),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "joinClass",
      args: Schema.Struct({ code: Schema.String }),
      returns: Schema.Struct({ classId: GenericId.GenericId("schoolClasses") }),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "joinPublicClass",
      args: Schema.Struct({ classId: GenericId.GenericId("schoolClasses") }),
      returns: Schema.Struct({ classId: GenericId.GenericId("schoolClasses") }),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateClassImage",
      args: Schema.Struct({
        classId: GenericId.GenericId("schoolClasses"),
        image: schoolClassImageSchema,
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateClassVisibility",
      args: Schema.Struct({
        classId: GenericId.GenericId("schoolClasses"),
        visibility: schoolClassVisibilitySchema,
      }),
      returns: Schema.Null,
    })
  );

export { classesMutationsGroup };
