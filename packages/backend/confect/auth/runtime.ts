import { ConvexConfigProvider, RegisteredFunction } from "@confect/server";
import type { GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { isActionCtx } from "@convex-dev/better-auth/utils";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import authConfig from "@repo/backend/confect/auth";
import { authComponent } from "@repo/backend/confect/auth/client";
import { readGoogleAuthConfig } from "@repo/backend/confect/auth/config";
import { ACCOUNT_DELETION_ATTEMPT_HEADER } from "@repo/backend/confect/auth/deletion/constants";
import {
  deletionUnavailableError,
  ensureAccountDeletionReady,
} from "@repo/backend/confect/auth/deletion/readiness";
import {
  hostOnlySessionCookieHandler,
  readSchoolTrustedOrigins,
} from "@repo/backend/confect/auth/host";
import { sanitizeProviderErrorRedirectResponse } from "@repo/backend/confect/auth/redirect";
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
import { readSiteUrls } from "@repo/backend/confect/site/config";
import {
  readUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@repo/backend/confect/users/username";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { openAPI, username } from "better-auth/plugins";
import {
  Array as Arr,
  Config,
  Effect,
  Layer,
  Option,
  Redacted,
  Result,
} from "effect";

/**
 * Better Auth's paths for password accounts. Each one stays closed on every
 * host. Sign-in with a school username is served on the school host alone
 * (`auth/login`, ADR 0009), and the email sign-in path is in `disabledSignInPaths`,
 * which also closes it for server code. `/is-username-available` is closed too,
 * because it would tell any visitor which school usernames exist.
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
/** The plugins of one Better Auth instance, as Better Auth types them. */
type AuthPlugins = NonNullable<BetterAuthOptions["plugins"]>;

/**
 * Supplies Better Auth's synchronous schema and adapter callback.
 * The component calls this during registration without request credentials.
 * `routerPlugins` holds what only the HTTP router adds, such as the school username
 * sign-in, which needs the request's host (`auth/login`).
 */
export const createAuthOptions = (
  ctx: GenericCtx<DataModel>,
  routerPlugins: AuthPlugins = []
) => {
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
      ...routerPlugins,
      openAPI(),
      // The plugin holds the global username of the account (ADR 0009), which is
      // the same value as `users.username`. A school login name lives in
      // `schoolLogins` and is separate from the username.
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
/**
 * Better Auth's base URL. A deployment that serves one site has that site's URL.
 * The dev deployment also serves staging, so Better Auth resolves the base URL,
 * the trusted origins and the cookies from the host of each request: each site
 * gets its own, and any other host, a school host included, gets the primary
 * site, as the fixed base URL does.
 */
function readAuthBaseUrl(sites: Arr.NonEmptyReadonlyArray<URL>) {
  const [primary, ...shared] = sites;
  if (shared.length === 0) {
    return primary.href;
  }
  return {
    allowedHosts: Arr.map(sites, (site) => site.origin),
    fallback: primary.href,
    protocol: "auto" as const,
  };
}

/**
 * Validates request configuration before creating a Better Auth instance. Only the
 * HTTP router passes `routerPlugins`; every other caller builds the instance without them.
 */
export const createAuth = Effect.fn("auth.createAuth")(function* (
  ctx: GenericCtx<DataModel>,
  routerPlugins: AuthPlugins = []
) {
  const sites = yield* readSiteUrls();
  const [siteUrl] = sites;
  const google = yield* readGoogleAuthConfig();
  return yield* Effect.sync(() => {
    const options = createAuthOptions(ctx, routerPlugins);
    const auth = betterAuth({
      ...options,
      advanced: {
        // The cookie domain is the host of the request's site, so every school
        // host under it shares the session (ADR 0026).
        crossSubDomainCookies: { enabled: true },
      },
      baseURL: readAuthBaseUrl(sites),
      trustedOrigins: readSchoolTrustedOrigins(siteUrl),
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
              sites
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
    // A plugin's response hook receives no request, so the host rule wraps the handler.
    return {
      ...auth,
      handler: hostOnlySessionCookieHandler(auth.handler, siteUrl),
    };
  });
});

/** The Better Auth instance that `createAuth` builds, for typed clients. */
export type Auth = Effect.Success<ReturnType<typeof createAuth>>;
