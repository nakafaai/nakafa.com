import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getAppUserByAuthId } from "@repo/backend/confect/users/directory";
import spec from "@repo/backend/confect/users/queries.spec";
import { Effect, Layer } from "effect";

/**
 * Get app user by app user ID.
 * Returns null if user doesn't exist.
 */
const getUserById = FunctionImpl.make(
  databaseSchema,
  spec,
  "getUserById",
  Effect.fn("users.queries.getUserById")(function* (args) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("users")
      .get(args.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  })
);
const getUserByAuthId = FunctionImpl.make(
  databaseSchema,
  spec,
  "getUserByAuthId",
  Effect.fn("users.queries.getUserByAuthId")(function* (args) {
    return yield* getAppUserByAuthId(args.authId);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getUserById),
  Layer.provide(getUserByAuthId),
  GroupImpl.finalize
);
