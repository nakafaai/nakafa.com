import type { GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { isActionCtx } from "@convex-dev/better-auth/utils";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { ensurePostHogErasureConfigured } from "@repo/backend/convex/analytics/erasure/action";
import { authComponent } from "@repo/backend/convex/auth/client";
import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
  ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
  ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
} from "@repo/backend/convex/auth/deletion/constants";
import {
  type AccountDeletionPreparationOutcome,
  accountDeletionPreparationOutcome,
} from "@repo/backend/convex/auth/deletion/spec";
import authConfig from "@repo/backend/convex/auth.config";
import { siteOrigin, siteUrl } from "@repo/backend/convex/utils/site";
import { APIError } from "better-auth/api";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { openAPI } from "better-auth/plugins";
import { makeFunctionReference } from "convex/server";
import { Effect, Schema } from "effect";

const claimAccountDeletion = makeFunctionReference<
  "mutation",
  {
    attemptId: string;
    authId: string;
  },
  AccountDeletionPreparationOutcome
>("auth/deletion:claimAccountDeletion");
const deletionUnavailableError = () =>
  APIError.from("INTERNAL_SERVER_ERROR", {
    code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
    message: "Account deletion is temporarily unavailable.",
  });
const providerErrorRoutePathnames = new Set(
  ACTIVE_APP_LOCALE_CODES.map((locale) => `/${locale}/auth/error`)
);
const disabledCredentialPaths = [
  "/change-password",
  "/request-password-reset",
  "/reset-password",
  "/set-password",
  "/sign-in/email",
  "/sign-in/username",
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
export function sanitizeProviderErrorRedirectResponse(response: Response) {
  const rawLocation = response.headers.get("location");
  if (!(rawLocation && response.status >= 300 && response.status < 400)) {
    return;
  }

  if (!URL.canParse(rawLocation, siteUrl)) {
    return;
  }
  const location = new URL(rawLocation, siteUrl);
  if (
    location.origin !== siteOrigin ||
    !providerErrorRoutePathnames.has(location.pathname)
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

const providerErrorRedirectPrivacy = {
  id: "provider-error-redirect-privacy",
  onResponse: (response: Response) => {
    const sanitized = sanitizeProviderErrorRedirectResponse(response);
    return Promise.resolve(sanitized ? { response: sanitized } : undefined);
  },
} satisfies NonNullable<BetterAuthOptions["plugins"]>[number];
const credentialSurfaceDisabled = {
  id: "credential-surface-disabled",
  onRequest: (request: Request, context: { readonly baseURL: string }) => {
    const basePath = new URL(context.baseURL).pathname.replace(
      trailingSlashPattern,
      ""
    );
    const requestPath = new URL(request.url).pathname;
    if (!requestPath.startsWith(`${basePath}${resetPasswordCallbackPath}`)) {
      return Promise.resolve();
    }

    return Promise.resolve({
      response: new Response("Not Found", { status: 404 }),
    });
  },
} satisfies NonNullable<BetterAuthOptions["plugins"]>[number];
/** Requires the server-side claim to confirm deletion readiness. */
export const verifyAccountDeletionPreparation = Effect.fn(
  "auth.verifyAccountDeletionPreparation"
)(function* (runPreparation: () => Promise<AccountDeletionPreparationOutcome>) {
  const preparationOutcome = yield* Effect.tryPromise({
    try: runPreparation,
    catch: deletionUnavailableError,
  });
  if (preparationOutcome === accountDeletionPreparationOutcome.continue) {
    return yield* Effect.fail(
      APIError.from("BAD_REQUEST", {
        code: ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
        message: "Account deletion preparation is incomplete.",
      })
    );
  }
  if (
    preparationOutcome ===
    accountDeletionPreparationOutcome.schoolSuccessorRequired
  ) {
    return yield* Effect.fail(
      APIError.from("BAD_REQUEST", {
        code: ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
        message: "An owned school needs another active member.",
      })
    );
  }
  if (
    preparationOutcome ===
    accountDeletionPreparationOutcome.temporarilyUnavailable
  ) {
    return yield* Effect.fail(deletionUnavailableError());
  }
});
const ensureAccountDeletionReady = Effect.fn("auth.ensureAccountDeletionReady")(
  function* (
    ctx: GenericCtx<DataModel>,
    authId: string,
    rawAttemptId: string | null
  ) {
    yield* ensurePostHogErasureConfigured().pipe(
      Effect.mapError(deletionUnavailableError)
    );
    if (!isActionCtx(ctx)) {
      return yield* Effect.fail(deletionUnavailableError());
    }
    const attemptId = yield* Schema.decodeUnknownEffect(
      Schema.String.check(Schema.isUUID())
    )(rawAttemptId).pipe(Effect.mapError(deletionUnavailableError));
    yield* verifyAccountDeletionPreparation(() =>
      ctx.runMutation(claimAccountDeletion, { attemptId, authId })
    );
  }
);
/** Builds Better Auth options for HTTP auth routes and component adapters. */
export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: false,
      },
    },
    disabledPaths: [...disabledCredentialPaths],
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      google: {
        clientId: process.env.AUTH_GOOGLE_ID || "",
        clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
        accessType: "offline",
        prompt: "select_account consent",
      },
    },
    user: {
      deleteUser: {
        beforeDelete: (user, request) =>
          Effect.runPromise(
            ensureAccountDeletionReady(
              ctx,
              user.id,
              request?.headers.get(ACCOUNT_DELETION_ATTEMPT_HEADER) ?? null
            )
          ),
        enabled: true,
      },
    },
    plugins: [
      credentialSurfaceDisabled,
      openAPI(),
      convex({
        authConfig,
        jwks: process.env.JWKS,
        jwksRotateOnTokenGenerationError: true,
      }),
      providerErrorRedirectPrivacy,
    ],
  }) satisfies BetterAuthOptions;
/** Creates one Better Auth instance for a Convex HTTP/action context. */
export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));
