import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import users from "@repo/backend/confect/_generated/tables/users";
import type { getCurrentUser } from "@repo/backend/confect/auth/identity";
import { Schema, Struct } from "effect";
/**
 * Gets the authenticated Better Auth user and matching app user, if present.
 *
 * @see https://docs.convex.dev/functions/query-functions#query-names
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.convexPublicQuery<typeof getCurrentUser>()("getCurrentUser")
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
