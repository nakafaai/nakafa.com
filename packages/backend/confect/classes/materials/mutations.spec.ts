import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessError } from "@repo/backend/confect/classes/access/spec";
import { MaterialGroupError } from "@repo/backend/confect/classes/materials/spec";
import { schoolClassMaterialStatusValidator } from "@repo/backend/confect/classes/schema";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PermissionDenied } from "@repo/backend/confect/schools/permission/spec";
import { Schema } from "effect";
/**
 * Reorder direction validator
 */
export const reorderDirectionValidator = Schema.Literals(["up", "down"]);
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createMaterialGroup",
      args: () => ({
        classId: IdSchema("schoolClasses"),
        name: Schema.String,
        description: Schema.String,
        status: schoolClassMaterialStatusValidator,
        scheduledAt: Schema.optionalKey(Schema.Finite),
      }),
      returns: () => IdSchema("schoolClassMaterialGroups"),
      error: () =>
        Schema.Union([
          AuthFailure,
          PermissionDenied,
          ClassAccessError,
          MaterialGroupError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateMaterialGroup",
      args: () => ({
        groupId: IdSchema("schoolClassMaterialGroups"),
        name: Schema.optionalKey(Schema.String),
        description: Schema.optionalKey(Schema.String),
        status: Schema.optionalKey(schoolClassMaterialStatusValidator),
        scheduledAt: Schema.optionalKey(Schema.Finite),
      }),
      returns: () => IdSchema("schoolClassMaterialGroups"),
      error: () =>
        Schema.Union([
          AuthFailure,
          PermissionDenied,
          ClassAccessError,
          MaterialGroupError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "publishMaterialGroup",
      args: () => ({
        groupId: IdSchema("schoolClassMaterialGroups"),
        publishedBy: IdSchema("users"),
      }),
      returns: () => Schema.Null,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deleteMaterialGroup",
      args: () => ({
        groupId: IdSchema("schoolClassMaterialGroups"),
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          AuthFailure,
          PermissionDenied,
          ClassAccessError,
          MaterialGroupError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reorderMaterialGroup",
      args: () => ({
        groupId: IdSchema("schoolClassMaterialGroups"),
        direction: reorderDirectionValidator,
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          AuthFailure,
          PermissionDenied,
          ClassAccessError,
          MaterialGroupError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
