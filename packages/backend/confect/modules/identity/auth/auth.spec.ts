import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import type { createClient } from "@convex-dev/better-auth";
import {
  authTriggerUserSchema,
  jwksSchema,
} from "@repo/backend/confect/modules/identity/auth/auth.schemas";
import { Users } from "@repo/backend/confect/modules/identity/users.tables";
import type { GenericDataModel } from "convex/server";
import { Schema } from "effect";

/**
 * Better Auth trigger functions are native Convex mutations. Deriving their
 * type from the component client avoids a spec -> refs -> spec cycle.
 */
type BetterAuthTriggerFunctions = ReturnType<
  ReturnType<typeof createClient<GenericDataModel>>["triggersApi"]
>;

export const authOnCreateSpec =
  FunctionSpec.convexInternalMutation<BetterAuthTriggerFunctions["onCreate"]>()(
    "onCreate"
  );

export const authOnDeleteSpec =
  FunctionSpec.convexInternalMutation<BetterAuthTriggerFunctions["onDelete"]>()(
    "onDelete"
  );

export const authOnUpdateSpec =
  FunctionSpec.convexInternalMutation<BetterAuthTriggerFunctions["onUpdate"]>()(
    "onUpdate"
  );

const authCleanupGroup = GroupSpec.make("cleanup").addFunction(
  FunctionSpec.internalMutation({
    name: "cleanupDeletedUser",
    args: Schema.Struct({ userId: GenericId.GenericId("users") }),
    returns: Schema.Null,
  })
);

export { authCleanupGroup };

const authSyncGroup = GroupSpec.make("sync")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "createSyncedUser",
      args: authTriggerUserSchema,
      returns: GenericId.GenericId("users"),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "updateSyncedUser",
      args: authTriggerUserSchema,
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanupSyncedUser",
      args: Schema.Struct({ authId: Schema.String }),
      returns: Schema.Null,
    })
  );

export { authSyncGroup };

const authGroup = GroupSpec.make("auth")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getCurrentUser",
      args: Schema.Struct({}),
      returns: Schema.Union(
        Schema.Struct({
          appUser: Users.Doc,
          authUser: Schema.Struct({
            _id: Schema.String,
            email: Schema.String,
            image: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
            name: Schema.String,
          }),
        }),
        Schema.Null
      ),
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "getLatestJwks",
      args: Schema.Struct({}),
      returns: jwksSchema,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getUserById",
      args: Schema.Struct({ userId: GenericId.GenericId("users") }),
      returns: Schema.Union(
        Schema.Struct({
          image: Schema.optional(Schema.String),
          name: Schema.String,
        }),
        Schema.Null
      ),
    })
  )
  .addFunction(authOnCreateSpec)
  .addFunction(authOnDeleteSpec)
  .addFunction(authOnUpdateSpec)
  .addGroup(authCleanupGroup)
  .addGroup(authSyncGroup);

export { authGroup };
