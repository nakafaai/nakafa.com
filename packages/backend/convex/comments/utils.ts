import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getAnyUserById } from "../auth";

/**
 * Attach user data to comments.
 * Fetches both app user and Better Auth user data for each unique user.
 */
export async function attachUsers(ctx: QueryCtx, comments: Doc<"comments">[]) {
  const uniqueUserIds = [...new Set(comments.map((c) => c.userId))];

  const users = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const appUser = await ctx.db.get(userId);
      if (!appUser) {
        return { userId, data: null };
      }

      const authUser = await getAnyUserById(ctx, appUser.authId);
      if (!authUser) {
        return { userId, data: null };
      }

      return { userId, data: { appUser, authUser } };
    })
  );

  return new Map(
    users
      .filter((item) => item.data !== null)
      .map(({ userId, data }) => [userId, data])
  );
}
