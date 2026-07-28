import type { GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { isActionCtx } from "@convex-dev/better-auth/utils";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { ensurePostHogDeletionConfigured } from "@repo/backend/convex/analytics/deletion";
import { authComponent } from "@repo/backend/convex/auth/client";
import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
  ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
} from "@repo/backend/convex/auth/deletion/constants";
import {
  type AccountDeletionPreparationOutcome,
  accountDeletionPreparationOutcome,
} from "@repo/backend/convex/auth/deletion/spec";
import { generatedUsername } from "@repo/backend/convex/auth/username/plugin";
import {
  createGoogleUsernameFields,
  usernameOptions,
} from "@repo/backend/convex/auth/username/policy";
import authConfig from "@repo/backend/convex/auth.config";
import { siteUrl } from "@repo/backend/convex/utils/site";
import { APIError } from "better-auth/api";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { anonymous, openAPI, username } from "better-auth/plugins";
import { makeFunctionReference } from "convex/server";
import { Effect, Schema } from "effect";

const prepareAccountDeletion = makeFunctionReference<
  "mutation",
  { attemptId: string; authId: string },
  AccountDeletionPreparationOutcome
>("auth/deletion:prepareAccountDeletion");
const disabledLegacyAnonymousPaths = [
  "/sign-in/anonymous",
  "/delete-anonymous-user",
];

const deletionUnavailableError = () =>
  APIError.from("INTERNAL_SERVER_ERROR", {
    code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
    message: "Account deletion is temporarily unavailable.",
  });

const ensureAccountDeletionReady = Effect.fn("auth.ensureAccountDeletionReady")(
  function* (
    ctx: GenericCtx<DataModel>,
    authId: string,
    rawAttemptId: string | null
  ) {
    yield* ensurePostHogDeletionConfigured().pipe(
      Effect.mapError(deletionUnavailableError)
    );

    if (!isActionCtx(ctx)) {
      return yield* Effect.fail(deletionUnavailableError());
    }

    const attemptId = yield* Schema.decodeUnknown(Schema.UUID)(
      rawAttemptId
    ).pipe(Effect.mapError(deletionUnavailableError));
    const runPreparation = () =>
      Effect.tryPromise({
        try: () =>
          ctx.runMutation(prepareAccountDeletion, { attemptId, authId }),
        catch: deletionUnavailableError,
      });
    let preparationOutcome = yield* runPreparation();

    while (preparationOutcome === accountDeletionPreparationOutcome.continue) {
      preparationOutcome = yield* runPreparation();
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
      return yield* Effect.fail(
        APIError.from("INTERNAL_SERVER_ERROR", {
          code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
          message: "Account deletion is temporarily unavailable.",
        })
      );
    }
  }
);

/** Builds Better Auth options for HTTP auth routes and component adapters. */
export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    disabledPaths: disabledLegacyAnonymousPaths,
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: false,
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: process.env.AUTH_GOOGLE_ID || "",
        clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
        accessType: "offline",
        prompt: "select_account consent",
        mapProfileToUser: createGoogleUsernameFields,
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
      anonymous({ disableDeleteAnonymousUser: true }),
      /*
       * generatedUsername() must run before Better Auth's username plugin so
       * Google-created users are normalized before username validation runs.
       * Source: the installed better-auth/dist/plugins/username/index.mjs.
       */
      generatedUsername(),
      username(usernameOptions),
      openAPI(),
      convex({
        authConfig,
        jwks: process.env.JWKS,
        jwksRotateOnTokenGenerationError: true,
      }),
    ],
  }) satisfies BetterAuthOptions;

/** Creates one Better Auth instance for a Convex HTTP/action context. */
export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));
