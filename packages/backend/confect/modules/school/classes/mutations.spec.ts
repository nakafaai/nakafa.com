import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const classesMutationsGroup = GroupSpec.make("mutations")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createClass",
      args: Schema.Struct({
        name: Schema.String,
        schoolId: GenericId.GenericId("schools"),
        subject: Schema.String,
        visibility: Schema.Literal("private", "public"),
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
        image: Schema.Literal(
          "retro",
          "time",
          "stars",
          "chill",
          "puzzle",
          "line",
          "shoot",
          "virus",
          "bacteria",
          "cooking",
          "disco",
          "logic",
          "ball",
          "duck",
          "music",
          "nightly",
          "writer",
          "barbie",
          "fun",
          "lamp",
          "lemon",
          "nighty",
          "rocket",
          "sakura",
          "sky",
          "stamp",
          "vintage"
        ),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateClassVisibility",
      args: Schema.Struct({
        classId: GenericId.GenericId("schoolClasses"),
        visibility: Schema.Literal("private", "public"),
      }),
      returns: Schema.Null,
    })
  );

export { classesMutationsGroup };
