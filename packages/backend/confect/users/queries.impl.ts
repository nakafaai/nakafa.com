import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { inspectUsername } from "@repo/backend/confect/users/availability";
import { getAppUserByAuthId } from "@repo/backend/confect/users/directory";
import spec from "@repo/backend/confect/users/queries.spec";
import { Effect, Layer, Result } from "effect";

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

/**
 * Answers while a person types a username. The caller's own username is
 * available to the caller, and a visitor without a session is answered the
 * same way as anyone else.
 */
const checkUsername = FunctionImpl.make(
  databaseSchema,
  spec,
  "checkUsername",
  Effect.fn("users.queries.checkUsername")(function* (args) {
    const account = yield* getOptionalAppUserForRead();
    const inspected = yield* inspectUsername(
      args.username,
      account?.appUser._id
    );
    return Result.isSuccess(inspected) ? "available" : inspected.failure;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getUserById),
  Layer.provide(getUserByAuthId),
  Layer.provide(checkUsername),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
