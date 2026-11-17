import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import users from "@repo/backend/confect/_generated/tables/users";
import { AuthReadError } from "@repo/backend/confect/auth/spec";
import { Schema } from "effect";

/**
 * The caller of an action, read in a query: an action has no database, and a
 * query that an action runs carries the action's identity.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "read",
    returns: () =>
      Schema.Struct({
        userId: Schema.NullOr(Id("users")),
        appUser: Schema.NullOr(users.Doc),
      }),
    error: () => AuthReadError,
  })
);
