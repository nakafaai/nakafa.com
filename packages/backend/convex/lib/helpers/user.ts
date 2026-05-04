/**
 * User data utilities.
 *
 * Batch fetch and map user data for efficient lookups.
 */

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { userDataValidator } from "@repo/backend/convex/lib/validators/user";
import type { Infer } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

export type UserData = Infer<typeof userDataValidator>;

/** Load one app user by the persisted Better Auth user ID. */
export function getAppUserByAuthId(ctx: QueryCtx, authId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authId))
    .unique();
}

/**
 * Batch fetch user data by IDs.
 * Uses denormalized name/image from users table (synced via auth triggers).
 * Single database read - no N+1 auth component calls.
 */
export async function getUserMap(ctx: QueryCtx, userIds: Id<"users">[]) {
  const uniqueUserIds = [...new Set(userIds)];
  const users = await getAll(ctx.db, uniqueUserIds);

  const entries: [Id<"users">, UserData][] = [];

  for (let i = 0; i < uniqueUserIds.length; i++) {
    const user = users[i];
    if (!user) {
      continue;
    }

    entries.push([
      uniqueUserIds[i],
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    ]);
  }

  return new Map(entries);
}
