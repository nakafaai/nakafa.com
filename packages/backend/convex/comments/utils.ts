import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getAnyUserById } from "../auth";
import { asyncMap, getAll } from "../lib/relationships";

export async function attachUsers(ctx: QueryCtx, comments: Doc<"comments">[]) {
  const uniqueUserIds = [...new Set(comments.map((c) => c.userId))];
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

export async function attachReplyToUsers(
  ctx: QueryCtx,
  comments: Doc<"comments">[]
) {
  const replyToUserIds = comments
    .map((c) => c.replyToUserId)
    .filter((id): id is Id<"users"> => id !== undefined);

  const uniqueUserIds = [...new Set(replyToUserIds)];
  if (uniqueUserIds.length === 0) {
    return new Map();
  }

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
