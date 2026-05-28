import type { GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
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
import { Effect, Schema } from "effect";

const AUTH_JWT_EXPIRATION_SECONDS = 5 * 60;

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
