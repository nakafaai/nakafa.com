import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getAnyUserById } from "../auth";
import { asyncMap, getAll } from "./relationships";

export type UserData = {
  _id: Id<"users">;
  name: string;
  email: string;
  image: string | null | undefined;
};

export async function getUserMap(ctx: QueryCtx, userIds: Id<"users">[]) {
  const uniqueUserIds = [...new Set(userIds)];
  const appUsers = await getAll(ctx.db, uniqueUserIds);

  const entries: [Id<"users">, UserData][] = [];

  await asyncMap(appUsers, async (appUser, index) => {
    const userId = uniqueUserIds[index];
    if (!appUser) {
      return;
    }

    const authUser = await getAnyUserById(ctx, appUser.authId);
    if (!authUser) {
      return;
    }

    entries.push([
      userId,
      {
        _id: appUser._id,
        name: authUser.name,
        email: authUser.email,
        image: authUser.image,
      },
    ]);
  });

  return new Map(entries);
}
