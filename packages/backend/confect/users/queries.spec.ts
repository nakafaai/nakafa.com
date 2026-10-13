import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import usersTable from "@repo/backend/confect/_generated/tables/users";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { UsernameCheck } from "@repo/backend/confect/users/username";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getUserById",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.NullOr(usersTable.Doc),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getUserByAuthId",
      args: () => ({
        authId: Schema.String,
      }),
      returns: () => Schema.NullOr(usersTable.Doc),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "checkUsername",
      args: () => ({
        username: Schema.String,
      }),
      returns: () => UsernameCheck,
      error: () => AuthFailure,
    }).middleware(Session)
  );
