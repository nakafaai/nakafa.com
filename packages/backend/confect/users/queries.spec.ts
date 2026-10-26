import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import usersTable from "@repo/backend/confect/_generated/tables/users";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { UsernameCheck } from "@repo/backend/confect/users/username";
import { Schema, Struct } from "effect";

/**
 * The face of a profile as its page shows it. It holds only what every profile
 * shows: never the email, the auth id, the plan, or the settings of the account.
 */
const publicProfileValidator = Schema.Struct({
  ...Struct.pick(usersTable.Doc.fields, ["_id", "bio", "mascot", "name"]),
  username: Schema.String,
  image: Schema.optionalKey(Schema.String),
});

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
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getProfileByUsername",
      args: () => ({
        username: Schema.String,
      }),
      returns: () => Schema.NullOr(publicProfileValidator),
    }).middleware(Session)
  );
