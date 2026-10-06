import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { userDataValidator } from "@repo/backend/confect/lib/validators/user";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, Struct } from "effect";
export type UserData = typeof userDataValidator.Type;

/** Resolve a persisted identity without weakening the unique auth index. */
export const getAppUserByAuthId = Effect.fn("users.directory.identity")(
  function* (authId: string) {
    return yield* (yield* DatabaseReader)
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
  userIds: readonly Id<"users">[]
) {
  const database = yield* DatabaseReader;
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
