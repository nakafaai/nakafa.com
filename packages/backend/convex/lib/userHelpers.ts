import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getAll } from "./relationships";

export interface UserData {
  _id: Id<"users">;
  name: string;
  email: string;
  image: string | null | undefined;
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
