import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import type { userDataValidator } from "@repo/backend/confect/lib/validators/user";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect, type Schema, Struct } from "effect";

export type UserData = Schema.Schema.Type<typeof userDataValidator>;

/** Resolve a persisted identity without weakening the unique auth index. */
export const getAppUserByAuthId = Effect.fn("users.directory.identity")(
  function* (ctx: QueryCtx, authId: string) {
    return yield* DatabaseReader.make(databaseSchema, ctx.db)
      .table("users")
      .get("by_authId", authId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  }
);

/** Read each distinct user once; deleted users have no directory entry. */
export const getUserMap = Effect.fn("users.directory.read")(function* (
  ctx: QueryCtx,
  userIds: readonly Id<"users">[]
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const users = yield* Effect.forEach([...new Set(userIds)], (id) =>
    database
      .table("users")
      .get(id)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      )
  );
  const entries: [Id<"users">, UserData][] = [];
  for (const user of users) {
    if (!user) {
      continue;
    }
    entries.push([
      user._id,
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        ...Struct.pick(user, ["image"]),
      },
    ]);
  }
  return new Map(entries);
});
