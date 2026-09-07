import { query } from "@repo/backend/convex/_generated/server";
import authSchema from "@repo/backend/convex/betterAuth/schema";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import schema from "@repo/backend/convex/schema";
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
      appUser: schema.doc("users"),
      authUser: authSchema.doc("user").extend({ _id: v.string() }),
    })
  ),
  handler: (ctx) => getOptionalAppUserForRead(ctx),
});

/** Gets a public user profile by app user id. */
export const getUserById = query({
  args: { userId: vv.id("users") },
  returns: nullable(
    schema
      .doc("users")
      .pick("name")
      .extend({ image: v.optional(v.string()) })
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);

    if (!user) {
      return null;
    }

    return {
      image: user.image ?? undefined,
      name: user.name,
    };
  },
});
