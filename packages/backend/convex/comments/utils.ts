import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getAnyUserById } from "../auth";
import { asyncMap, getAll } from "../lib/relationships";

/**
 * Attach user data to comments.
 * Fetches both app user and Better Auth user data for each unique user.
 * Uses batch fetching with getAll for better performance.
 */
export async function attachUsers(ctx: QueryCtx, comments: Doc<"comments">[]) {
  const uniqueUserIds = [...new Set(comments.map((c) => c.userId))];

  // Batch fetch all app users at once
  const appUsers = await getAll(ctx.db, uniqueUserIds);

  // Build user map with auth data
  const userEntries = await asyncMap(appUsers, async (appUser, index) => {
    const userId = uniqueUserIds[index];

    if (!appUser) {
      return { userId, data: null };
    }

    const authUser = await getAnyUserById(ctx, appUser.authId);
    if (!authUser) {
      return { userId, data: null };
    }

    return { userId, data: { appUser, authUser } };
  });

  return new Map(
    userEntries
      .filter(
        (
          item
        ): item is {
          userId: Id<"users">;
          data: NonNullable<typeof item.data>;
        } => item.data !== null
      )
      .map(({ userId, data }) => [userId, data])
  );
}
