import { ConvexConfigProvider, RegisteredFunction } from "@confect/server";
import type { GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { isActionCtx } from "@convex-dev/better-auth/utils";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import { ensurePostHogErasureConfigured } from "@repo/backend/confect/analytics/erasure/action";
import authConfig from "@repo/backend/confect/auth";
import type { UserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { authComponent } from "@repo/backend/confect/auth/client";
import { readGoogleAuthConfig } from "@repo/backend/confect/auth/config";
import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
} from "@repo/backend/confect/auth/deletion/constants";
import {
  type AccountDeletionPreparationOutcome,
  accountDeletionPreparationOutcome,
} from "@repo/backend/confect/auth/deletion/spec";
import {
  disabledSignInPaths,
  disabledTokenPaths,
  passwordSignInRoutesDisabled,
  tokenRoutesDisabled,
  usernameUpdatesDisabled,
} from "@repo/backend/confect/auth/routes";
import {
  accountTokenHooks,
  googleSignIn,
} from "@repo/backend/confect/auth/tokens";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import {
  readUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@repo/backend/confect/users/username";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { APIError } from "better-auth/api";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { openAPI, username } from "better-auth/plugins";
import {
  Array as Arr,
  Config,
  Effect,
  HashSet,
  Layer,
  Option,
  Redacted,
  Result,
  Schema,
} from "effect";

const deletionUnavailableError = () =>
  APIError.from("INTERNAL_SERVER_ERROR", {
    code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
    message: "Account deletion is temporarily unavailable.",
  });
const providerErrorRoutePathnames = HashSet.fromIterable(
  Arr.map(ACTIVE_APP_LOCALE_CODES, (locale) => `/${locale}/auth/error`)
);
/**
 * Better Auth's paths for password accounts. Each one stays closed on every
 * host: sign-in with a school username opens later, on the school host alone
 * (ADR 0009). The sign-in paths are in `disabledSignInPaths`, which also closes
 * them for server code. `/is-username-available` is closed too, because it would
 * tell any visitor which school usernames exist.
 */
const disabledCredentialPaths = [
  "/change-password",
  "/is-username-available",
  "/request-password-reset",
  "/reset-password",
  "/set-password",
  "/sign-up/email",
  "/verify-password",
] as const;
const resetPasswordCallbackPath = "/reset-password/";
const trailingSlashPattern = /\/$/;

/**
 * Removes provider-owned diagnostics before the redirect crosses into the app.
 *
 * Better Auth appends `error` and `error_description` to `errorCallbackURL`.
 * The app error landing needs only its validated continuation intent, so every
 * other query value and fragment is discarded at the auth response boundary.
 */
export function sanitizeProviderErrorRedirectResponse(
  response: Response,
  siteUrl: URL
) {
  const rawLocation = response.headers.get("location");
  if (!(rawLocation && response.status >= 300 && response.status < 400)) {
    return;
  }
  if (!URL.canParse(rawLocation, siteUrl)) {
    return;
  }
  const location = new URL(rawLocation, siteUrl);
  if (
    location.origin !== siteUrl.origin ||
    !HashSet.has(providerErrorRoutePathnames, location.pathname)
  ) {
    return;
  }
  const intent = location.searchParams.get("intent");
  location.search = "";
  location.hash = "";
  if (intent !== null) {
    location.searchParams.set("intent", intent);
  }
  const headers = new Headers(response.headers);
  headers.set("location", location.href);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
const credentialSurfaceDisabled = {
  id: "credential-surface-disabled",
  onRequest: (
    request: Request,
    context: {
      readonly baseURL: string;
    }
  ) => {
    const basePath = new URL(context.baseURL).pathname.replace(
      trailingSlashPattern,
      ""
    );
    const requestPath = new URL(request.url).pathname;
    if (!requestPath.startsWith(`${basePath}${resetPasswordCallbackPath}`)) {
      return Promise.resolve();
    }
    return Promise.resolve({
      response: new Response("Not Found", {
        status: 404,
      }),
    });
  },
} satisfies NonNullable<BetterAuthOptions["plugins"]>[number];
/** Requires the server-side claim to confirm deletion readiness. */
export const verifyAccountDeletionPreparation = Effect.fn(
  "auth.verifyAccountDeletionPreparation"
)(function* (
  preparation: Effect.Effect<
    AccountDeletionPreparationOutcome,
    UserCleanupError | Schema.SchemaError
  >
) {
  const preparationOutcome = yield* preparation.pipe(
    Effect.mapError(deletionUnavailableError),
    Effect.catchDefect(() => Effect.fail(deletionUnavailableError()))
  );
  if (
    preparationOutcome ===
    accountDeletionPreparationOutcome.temporarilyUnavailable
  ) {
    return yield* Effect.fail(deletionUnavailableError());
  }
});
const ensureAccountDeletionReady = Effect.fn("auth.ensureAccountDeletionReady")(
  function* (authId: string, rawAttemptId: string | null) {
    yield* ensurePostHogErasureConfigured().pipe(
      Effect.mapError(deletionUnavailableError)
    );
    const attemptId = yield* Schema.decodeUnknownEffect(
      Schema.String.check(Schema.isUUID())
    )(rawAttemptId).pipe(Effect.mapError(deletionUnavailableError));
    const { runMutation } = yield* MutationRunner;
    yield* verifyAccountDeletionPreparation(
      runMutation(refs.internal.auth.deletion.claimAccountDeletion, {
        attemptId,
        authId,
      })
    );
  }
);
/**
 * Supplies Better Auth's synchronous schema and adapter callback.
 * The component calls this during registration without request credentials.
 */
export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const jwks = Effect.runSync(
    Config.option(Config.String("JWKS")).parse(ConvexConfigProvider.make())
  );
  return {
    database: authComponent.adapter(ctx),
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: false,
      },
      // The hooks below keep every provider token out of the table, so this
      // seals only a token that a later plugin might write there.
      encryptOAuthTokens: true,
    },
    databaseHooks: accountTokenHooks,
    disabledPaths: [
      ...disabledCredentialPaths,
      ...disabledSignInPaths,
      ...disabledTokenPaths,
    ],
    // Passwords are a store for school accounts only: nobody signs up with one,
    // and a password reset (a card redemption) ends every session it replaces.
    emailAndPassword: {
      disableSignUp: true,
      enabled: true,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      deleteUser: {
        beforeDelete: (user, request): Promise<void> =>
          Effect.gen(function* () {
            if (!isActionCtx(ctx)) {
              return yield* Effect.fail(deletionUnavailableError());
            }
            return yield* ensureAccountDeletionReady(
              user.id,
              request?.headers.get(ACCOUNT_DELETION_ATTEMPT_HEADER) ?? null
            ).pipe(
              Effect.provide(
                Layer.provideMerge(
                  RegisteredFunction.actionLayer(databaseSchema, ctx),
                  ConvexConfigProvider.layer
                )
              )
            );
          }).pipe(Effect.runPromise),
        enabled: true,
      },
    },
    plugins: [
      credentialSurfaceDisabled,
      tokenRoutesDisabled,
      passwordSignInRoutesDisabled,
      usernameUpdatesDisabled,
      openAPI(),
      // A school username is the global username of the account (ADR 0009), so
      // the plugin holds the same value as `users.username`, under one rule.
      username({
        maxUsernameLength: USERNAME_MAX_LENGTH,
        minUsernameLength: USERNAME_MIN_LENGTH,
        usernameValidator: (value) => Result.isSuccess(readUsername(value)),
        validationOrder: { username: "post-normalization" },
      }),
      convex({
        authConfig,
        ...(Option.isNone(jwks) ? {} : { jwks: jwks.value }),
        jwksRotateOnTokenGenerationError: true,
      }),
    ],
  } satisfies BetterAuthOptions;
};
/** Validates request configuration before creating a Better Auth instance. */
export const createAuth = Effect.fn("auth.createAuth")(function* (
  ctx: GenericCtx<DataModel>
) {
  const siteUrl = yield* readSiteUrl();
  const google = yield* readGoogleAuthConfig();
  return yield* Effect.sync(() => {
    const options = createAuthOptions(ctx);
    return betterAuth({
      ...options,
      baseURL: siteUrl.href,
      socialProviders: {
        google: {
          clientId: google.clientId,
          clientSecret: Redacted.value(google.clientSecret),
          ...googleSignIn,
        },
      },
      plugins: [
        ...options.plugins,
        {
          id: "provider-error-redirect-privacy",
          onResponse: (response: Response) => {
            const sanitized = sanitizeProviderErrorRedirectResponse(
              response,
              siteUrl
            );
            return Promise.resolve(
              sanitized
                ? {
                    response: sanitized,
                  }
                : undefined
            );
          },
        },
      ],
    });
  });
});

/** The Better Auth instance that `createAuth` builds, for typed clients. */
export type Auth = Effect.Success<ReturnType<typeof createAuth>>;
