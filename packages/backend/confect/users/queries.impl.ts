import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { inspectUsername } from "@repo/backend/confect/users/availability";
import {
  getAppUserByAuthId,
  getAppUserByUsername,
} from "@repo/backend/confect/users/directory";
import { photoOf } from "@repo/backend/confect/users/picture";
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
 * The public profile of the account that holds a username, or null when no
 * account holds it. Anyone may read it, signed in or not.
 */
const getProfileByUsername = FunctionImpl.make(
  databaseSchema,
  spec,
  "getProfileByUsername",
  Effect.fn("users.queries.getProfileByUsername")(function* (args) {
    const user = yield* getAppUserByUsername(args.username);
    if (user === null) {
      return null;
    }
    // The index matched this exact name, so the account holds the name asked for.
    // The photo leaves the server only while the account shows it.
    const photo = photoOf(user);
    return {
      _id: user._id,
      mascot: user.mascot,
      name: user.name,
      username: args.username,
      ...(user.bio === undefined ? {} : { bio: user.bio }),
      ...(photo === undefined ? {} : { image: photo }),
    };
  })
);

/**
 * Answers while a person types a username, in the settings of their own
 * account. The caller's own username is available to the caller. A visitor
 * without a session is refused, because an answer to anyone would tell which
 * usernames exist.
 */
const checkUsername = FunctionImpl.make(
  databaseSchema,
  spec,
  "checkUsername",
  Effect.fn("users.queries.checkUsername")(function* (args) {
    const { appUser } = yield* requireAuth();
    const inspected = yield* inspectUsername(args.username, appUser._id);
    return Result.isSuccess(inspected) ? "available" : inspected.failure;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getUserById),
  Layer.provide(getUserByAuthId),
  Layer.provide(getProfileByUsername),
  Layer.provide(checkUsername),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
