import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import users from "@repo/backend/confect/_generated/tables/users";
import { Account } from "@repo/backend/confect/auth/schema";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema, Struct } from "effect";
/**
 * Gets the authenticated Better Auth user and matching app user, if present.
 *
 * @see https://docs.convex.dev/functions/query-functions#query-names
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getCurrentUser",
      returns: () => Schema.NullOr(Account),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getUserById",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () =>
        Schema.NullOr(
          Schema.Struct({
            ...users.Doc.mapFields(Struct.pick(["name"])).fields,
            ...{
              image: Schema.optionalKey(Schema.String),
            },
          })
        ),
    })
  );
