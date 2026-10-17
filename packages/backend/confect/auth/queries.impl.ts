import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/auth/queries.spec";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import session from "@repo/backend/confect/middleware/session.impl";
import { photoOf } from "@repo/backend/confect/users/picture";
import { Effect, Layer, Struct } from "effect";

/**
 * The app user holds a copy of the Better Auth profile that auth triggers keep
 * current, so the account projection needs no component read.
 */
const getCurrentUser = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCurrentUser",
  Effect.fn("auth.queries.getCurrentUser")(function* () {
    const account = yield* getOptionalAppUserForRead();
    if (!account) {
      return null;
    }
    const { appUser, authId } = account;
    return {
      appUser,
      authUser: {
        _id: authId,
        email: appUser.email,
        name: appUser.name,
        ...(appUser.image === undefined ? {} : { image: appUser.image }),
      },
    };
  })
);
const getUserById = FunctionImpl.make(
  databaseSchema,
  spec,
  "getUserById",
  Effect.fn("auth.queries.getUserById")(function* (args) {
    const database = yield* DatabaseReader;
    const user = yield* database
      .table("users")
      .get(args.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!user) {
      return null;
    }
    // The photo leaves the server only while the account shows it, so an animal
    // hides the photo from every reader.
    const photo = photoOf(user);
    return {
      ...Struct.pick(user, ["mascot", "picture"]),
      ...(photo === undefined ? {} : { image: photo }),
      name: user.name,
    };
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getCurrentUser),
  Layer.provide(getUserById),
  Layer.provide(session),
  GroupImpl.finalize
);
