import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { userDataValidator } from "@repo/backend/confect/lib/validators/user";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, HashMap, Struct } from "effect";
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
  const users = yield* Effect.forEach(Arr.dedupe(userIds), (id) =>
    database
      .table("users")
      .get(id)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      )
  );
  let entries: [Id<"users">, UserData][] = [];
  for (const user of users) {
    if (!user) {
      continue;
    }
    entries = Arr.append(entries, [
      user._id,
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        ...Struct.pick(user, ["image"]),
      },
    ]);
  }
  return HashMap.fromIterable(entries);
});
