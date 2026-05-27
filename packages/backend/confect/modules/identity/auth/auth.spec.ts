import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { jwksSchema } from "@repo/backend/confect/modules/identity/auth/auth.schemas";
import type {
  BetterAuthCreateTrigger,
  BetterAuthDeleteTrigger,
  BetterAuthUpdateTrigger,
} from "@repo/backend/confect/modules/identity/auth.adapter-types";
import { Users } from "@repo/backend/confect/modules/identity/users.tables";
import { Schema } from "effect";

const authCleanupGroup = GroupSpec.make("cleanup").addFunction(
  FunctionSpec.internalMutation({
    name: "cleanupDeletedUser",
    args: Schema.Struct({ userId: GenericId.GenericId("users") }),
    returns: Schema.Null,
  })
);

export { authCleanupGroup };

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
  .addFunction(
    FunctionSpec.convexInternalMutation<BetterAuthCreateTrigger>()("onCreate")
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<BetterAuthDeleteTrigger>()("onDelete")
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<BetterAuthUpdateTrigger>()("onUpdate")
  )
  .addGroup(authCleanupGroup);

export { authGroup };
