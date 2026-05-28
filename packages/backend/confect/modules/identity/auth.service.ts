import type { GenericId } from "@confect/core";
import type { GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  ActionCtx,
  Auth,
  DatabaseReader,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { jwksSchema } from "@repo/backend/confect/modules/identity/auth/auth.schemas";
import { authComponent } from "@repo/backend/confect/modules/identity/auth.client";
import authConfig from "@repo/backend/confect/modules/identity/auth.config";
import { authEnvironment } from "@repo/backend/confect/modules/identity/auth.env";
import type { ConvexDataModel } from "@repo/backend/confect/modules/shared/convexContext";
import { betterAuth } from "better-auth/minimal";
import {
  anonymous,
  openAPI,
  organization,
  username,
} from "better-auth/plugins";
import { Effect, Option, Schema } from "effect";

const AUTH_JWT_EXPIRATION_SECONDS = 5 * 60;
const authIdentitySchema = Schema.Struct({ subject: Schema.String });

export class UnauthorizedUser extends Schema.TaggedError<UnauthorizedUser>()(
  "UnauthorizedUser",
  { message: Schema.String }
) {}

export class AuthJwksRequestError extends Schema.TaggedError<AuthJwksRequestError>()(
  "AuthJwksRequestError",
  { message: Schema.String }
) {}

/** Maps a Google OAuth profile to Better Auth username fields. */
function mapGoogleProfileToUser(profile: { email: string }) {
  return {
    displayUsername: profile.email.split("@")[0],
    username: profile.email,
  };
}

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

/** Requires the current action request to resolve to a mapped app user. */
export const requireAppUserForAction = Effect.fn(
  "identity.requireAppUserForAction"
)(function* () {
  const runQuery = yield* QueryRunner;
  const identity = yield* readAuthIdentity();

  if (!identity) {
    return yield* Effect.fail(
      new UnauthorizedUser({ message: "User not found." })
    );
  }

  const appUser = yield* runQuery(refs.internal.users.queries.getUserByAuthId, {
    authId: identity.subject,
  });

  if (!appUser) {
    return yield* Effect.fail(
      new UnauthorizedUser({ message: "User not found." })
    );
  }

  return {
    appUser,
    authUser: mapAppUserToAuthUser(appUser),
  };
});

/** Builds Better Auth options for Convex HTTP and action boundaries. */
export const createAuthOptions = (ctx: GenericCtx<ConvexDataModel>) => ({
  account: {
    accountLinking: {
      allowDifferentEmails: false,
      enabled: true,
    },
  },
  baseURL: authEnvironment.siteUrl,
  database: authComponent.adapter(ctx),
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    anonymous(),
    username(),
    organization(),
    openAPI(),
    convex({
      authConfig,
      jwks: authEnvironment.jwks,
      jwksRotateOnTokenGenerationError: true,
      jwt: { expirationSeconds: AUTH_JWT_EXPIRATION_SECONDS },
    }),
  ],
  socialProviders: {
    google: {
      accessType: "offline" as const,
      clientId: authEnvironment.googleClientId,
      clientSecret: authEnvironment.googleClientSecret,
      prompt: "select_account consent" as const,
      mapProfileToUser: mapGoogleProfileToUser,
    },
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
});

/** Creates the Better Auth runtime for Convex boundaries. */
export const createAuth = (ctx: GenericCtx<ConvexDataModel>) =>
  betterAuth(createAuthOptions(ctx));

/** Reads the current mapped app user for public queries. */
export const getCurrentUser = Effect.fn("identity.getCurrentUser")(
  function* () {
    return yield* getOptionalAppUser();
  }
);

/**
 * Reads the Better Auth static JWKS documents for `convex env set JWKS`.
 *
 * References:
 * - https://labs.convex.dev/better-auth/experimental#static-jwks
 * - https://github.com/get-convex/better-auth/blob/main/src/plugins/convex/index.ts
 */
export const getLatestJwks = Effect.fn("identity.getLatestJwks")(function* () {
  const ctx = yield* ActionCtx;
  const auth = createAuth(ctx);

  const jwks = yield* Effect.tryPromise({
    try: () => auth.api.getLatestJwks(),
    catch: () =>
      new AuthJwksRequestError({
        message: "Unable to read the latest Better Auth JWKS.",
      }),
  });

  return yield* Schema.decodeUnknown(jwksSchema)(jwks).pipe(
    Effect.mapError(
      () =>
        new AuthJwksRequestError({
          message: "Better Auth JWKS response did not match static JWKS.",
        })
    )
  );
});

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

/** Identity service accessors used by Confect function implementations. */
export class Identity extends Effect.Service<Identity>()("Identity", {
  accessors: true,
  succeed: {
    createAuth,
    createAuthOptions,
    getAppUserByAuthId,
    getCurrentUser,
    getLatestJwks,
    getOptionalAppUser,
    getPublicUserById,
    requireAppUser,
    requireAppUserForAction,
  },
}) {}
