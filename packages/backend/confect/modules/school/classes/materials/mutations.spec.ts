import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { schoolClassMaterialStatusSchema } from "@repo/backend/confect/modules/school/classes.tables";
import { orderDirectionSchema } from "@repo/backend/confect/modules/school/order.schemas";
import { Schema } from "effect";

const classesMaterialsMutationsGroup = GroupSpec.make("mutations")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createMaterialGroup",
      args: Schema.Struct({
        classId: GenericId.GenericId("schoolClasses"),
        description: Schema.String,
        name: Schema.String,
        scheduledAt: Schema.optional(Schema.Number),
        status: schoolClassMaterialStatusSchema,
      }),
      returns: GenericId.GenericId("schoolClassMaterialGroups"),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deleteMaterialGroup",
      args: Schema.Struct({
        groupId: GenericId.GenericId("schoolClassMaterialGroups"),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "publishMaterialGroup",
      args: Schema.Struct({
        groupId: GenericId.GenericId("schoolClassMaterialGroups"),
        publishedBy: GenericId.GenericId("users"),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reorderMaterialGroup",
      args: Schema.Struct({
        direction: orderDirectionSchema,
        groupId: GenericId.GenericId("schoolClassMaterialGroups"),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateMaterialGroup",
      args: Schema.Struct({
        description: Schema.optional(Schema.String),
        groupId: GenericId.GenericId("schoolClassMaterialGroups"),
        name: Schema.optional(Schema.String),
        scheduledAt: Schema.optional(Schema.Number),
        status: Schema.optional(schoolClassMaterialStatusSchema),
      }),
      returns: GenericId.GenericId("schoolClassMaterialGroups"),
    })
  );

export { classesMaterialsMutationsGroup };
