import { SchemaToValidator } from "@confect/core";
import authSchema from "@repo/backend/components/betterAuth/schema";
import users from "@repo/backend/confect/_generated/tables/users";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { query } from "@repo/backend/convex/_generated/server";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/**
 * Gets the authenticated Better Auth user and matching app user, if present.
 *
 * @see https://docs.convex.dev/functions/query-functions#query-names
 */
export const getCurrentUser = query({
  args: {},
  returns: nullable(
    v.object({
      appUser: SchemaToValidator.compileSchema(users.Doc),
      authUser: authSchema.doc("user").extend({
        _id: v.string(),
      }),
    })
  ),
  handler: (ctx) => runConvexProgram(getOptionalAppUserForRead(ctx)),
});
