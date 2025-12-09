import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getAnyUserById } from "../auth";
import { asyncMap, getAll } from "../lib/relationships";

/**
 * Attach user data to forums (createdBy).
 */
export async function attachForumUsers(
  ctx: QueryCtx,
  forums: Doc<"schoolClassForums">[]
) {
  const uniqueUserIds = [...new Set(forums.map((f) => f.createdBy))];
  const appUsers = await getAll(ctx.db, uniqueUserIds);

  const userEntries = await asyncMap(appUsers, async (appUser, index) => {
    const userId = uniqueUserIds[index];
    if (!appUser) {
      return { userId, data: null };
    }

    const authUser = await getAnyUserById(ctx, appUser.authId);
    if (!authUser) {
      return { userId, data: null };
    }

    return {
      userId,
      data: {
        _id: appUser._id,
        name: authUser.name,
        image: authUser.image,
      },
    };
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
