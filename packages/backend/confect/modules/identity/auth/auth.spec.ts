import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import type {
  onCreate,
  onDelete,
  onUpdate,
} from "@repo/backend/confect/modules/identity/auth/auth";
import {
  authTriggerUserSchema,
  jwksSchema,
} from "@repo/backend/confect/modules/identity/auth/auth.schemas";
import { Users } from "@repo/backend/confect/modules/identity/users.tables";
import { Schema } from "effect";

export const authOnCreateSpec =
  FunctionSpec.convexInternalMutation<typeof onCreate>()("onCreate");

export const authOnDeleteSpec =
  FunctionSpec.convexInternalMutation<typeof onDelete>()("onDelete");

export const authOnUpdateSpec =
  FunctionSpec.convexInternalMutation<typeof onUpdate>()("onUpdate");

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

export const authNodeGroup = GroupSpec.makeNode("auth").addFunction(
  FunctionSpec.internalNodeAction({
    name: "getLatestJwks",
    args: Schema.Struct({}),
    returns: jwksSchema,
  })
);

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
