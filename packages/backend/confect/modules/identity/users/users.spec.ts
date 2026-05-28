import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  getUserByAuthIdArgsSchema,
  getUserByIdArgsSchema,
  updateUserNameArgsSchema,
  updateUserRoleArgsSchema,
} from "@repo/backend/confect/modules/identity/users.schemas";
import {
  Users,
  userRoleSchema,
} from "@repo/backend/confect/modules/identity/users.tables";
import { Schema } from "effect";

const usersMutationsGroup = GroupSpec.make("mutations")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateUserRole",
      args: updateUserRoleArgsSchema,
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateUserName",
      args: updateUserNameArgsSchema,
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
      args: getUserByIdArgsSchema,
      returns: Schema.NullOr(Users.Doc),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getUserByAuthId",
      args: getUserByAuthIdArgsSchema,
      returns: Schema.NullOr(Users.Doc),
    })
  );

export { usersQueriesGroup };

const usersGroup = GroupSpec.make("users")
  .addGroup(usersMutationsGroup)
  .addGroup(usersQueriesGroup);

export { usersGroup };
