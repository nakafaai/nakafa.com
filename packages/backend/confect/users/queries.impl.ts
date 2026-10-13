import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { inspectUsername } from "@repo/backend/confect/users/availability";
import {
  getAppUserByAuthId,
  getAppUserByUsername,
} from "@repo/backend/confect/users/directory";
import spec from "@repo/backend/confect/users/queries.spec";
import { readUsername } from "@repo/backend/confect/users/username";
import { Effect, Layer, Result, Struct } from "effect";

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

/**
 * Reads the public profile at `@username`. A text that is not a username, a
 * username nobody holds, and a deleted account answer alike: no profile.
 */
const getProfileByUsername = FunctionImpl.make(
  databaseSchema,
  spec,
  "getProfileByUsername",
  Effect.fn("users.queries.getProfileByUsername")(function* (args) {
    const username = readUsername(args.username);
    if (Result.isFailure(username)) {
      return null;
    }
    const user = yield* getAppUserByUsername(username.success);
    if (user === null || user.deletedAt !== undefined) {
      return null;
    }
    return {
      _id: user._id,
      name: user.name,
      username: username.success,
      ...Struct.pick(user, ["bio", "image"]),
    };
  })
);

/**
 * Reads the username of an account from the id that older addresses carry.
 * The id comes from a URL, so a text that is no id of a user answers like an
 * account without a username.
 */
const getUsernameById = FunctionImpl.make(
  databaseSchema,
  spec,
  "getUsernameById",
  Effect.fn("users.queries.getUsernameById")(function* (args) {
    const ctx = yield* QueryCtxService;
    const userId = ctx.db.normalizeId("users", args.userId);
    if (userId === null) {
      return null;
    }
    const user = yield* (yield* DatabaseReader)
      .table("users")
      .get(userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    return user === null || user.deletedAt !== undefined
      ? null
      : (user.username ?? null);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getUserById),
  Layer.provide(getUserByAuthId),
  Layer.provide(checkUsername),
  Layer.provide(getProfileByUsername),
  Layer.provide(getUsernameById),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
