import type { GenericId } from "@confect/core";
import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import {
  Auth,
  DatabaseReader,
} from "@repo/backend/confect/_generated/services";
import { Effect, Option, Schema } from "effect";

const authIdentitySchema = Schema.Struct({ subject: Schema.String });

export class UnauthorizedUser extends Schema.TaggedError<UnauthorizedUser>()(
  "UnauthorizedUser",
  { message: Schema.String }
) {}

/** Maps the synced app user fields back to the auth profile shape used by UI. */
function mapAppUserToAuthUser(appUser: Doc<"users">) {
  const authUser = {
    _id: appUser.authId,
    email: appUser.email,
    name: appUser.name,
  };

  if (appUser.image === undefined) {
    return authUser;
  }

  return { ...authUser, image: appUser.image };
}

/** Reads the Convex JWT identity issued by Better Auth. */
const readAuthIdentity = Effect.fn("identity.readAuthIdentity")(function* () {
  const auth = yield* Auth;
  const identity = yield* auth.getUserIdentity.pipe(
    Effect.catchTag("NoUserIdentityFoundError", () => Effect.succeed(null))
  );

  if (!identity) {
    return null;
  }

  return yield* Schema.decodeUnknown(authIdentitySchema)(identity).pipe(
    Effect.orElseSucceed(() => null)
  );
});

/** Returns the app user mapped to a Better Auth user id. */
export const getAppUserByAuthId = Effect.fn("identity.getAppUserByAuthId")(
  function* (authId: string) {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("users")
      .index("by_authId", (query) => query.eq("authId", authId))
      .first()
      .pipe(Effect.map(Option.getOrNull));
  }
);

/** Resolves the current valid Better Auth session to the synced app user. */
const getSessionAppUser = Effect.fn("identity.getSessionAppUser")(function* () {
  const identity = yield* readAuthIdentity();

  if (!identity) {
    return null;
  }

  const appUser = yield* getAppUserByAuthId(identity.subject);

  if (!appUser) {
    return null;
  }

  return {
    appUser,
    authUser: mapAppUserToAuthUser(appUser),
  };
});

/** Returns the current Better Auth user and app user when both exist. */
export const getOptionalAppUser = Effect.fn("identity.getOptionalAppUser")(
  function* () {
    return yield* getSessionAppUser();
  }
);

/** Requires the current request to resolve to a mapped app user. */
export const requireAppUser = Effect.fn("identity.requireAppUser")(
  function* () {
    const user = yield* getSessionAppUser();

    if (!user) {
      return yield* Effect.fail(
        new UnauthorizedUser({ message: "User not found." })
      );
    }

    return user;
  }
);

/** Reads the current mapped app user for public queries. */
export const getCurrentUser = Effect.fn("identity.getCurrentUser")(
  function* () {
    return yield* getOptionalAppUser();
  }
);

/** Reads the public profile fields for an app user id. */
export const getPublicUserById = Effect.fn("identity.getPublicUserById")(
  function* (args: { userId: GenericId.GenericId<"users"> }) {
    const reader = yield* DatabaseReader;
    const user = yield* reader
      .table("users")
      .get(args.userId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!user) {
      return null;
    }

    if (user.image === undefined) {
      return { name: user.name };
    }

    return { image: user.image, name: user.name };
  }
);
