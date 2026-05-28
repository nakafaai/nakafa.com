import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  selfSelectableUserRoleSchema,
  Users,
  userRoleSchema,
} from "@repo/backend/confect/modules/identity/users.tables";
import { Schema } from "effect";

const usersMutationsGroup = GroupSpec.make("mutations")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateUserRole",
      args: Schema.Struct({
        role: selfSelectableUserRoleSchema,
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateUserName",
      args: Schema.Struct({ name: Schema.String }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "syncUserInfoForChat",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        credits: Schema.Number,
        role: userRoleSchema,
        userId: GenericId.GenericId("users"),
      }),
    })
  );

export { usersMutationsGroup };

const usersQueriesGroup = GroupSpec.make("queries")
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getUserById",
      args: Schema.Struct({ userId: GenericId.GenericId("users") }),
      returns: Schema.NullOr(Users.Doc),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getUserByAuthId",
      args: Schema.Struct({ authId: Schema.String }),
      returns: Schema.NullOr(Users.Doc),
    })
  );

export { usersQueriesGroup };

const usersGroup = GroupSpec.make("users")
  .addGroup(usersMutationsGroup)
  .addGroup(usersQueriesGroup);

export { usersGroup };
