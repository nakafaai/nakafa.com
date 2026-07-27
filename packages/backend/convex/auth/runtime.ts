import type { GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { cleanupAuthRelations } from "@repo/backend/convex/auth/cleanup/relations";
import { authComponent } from "@repo/backend/convex/auth/client";
import { generatedUsername } from "@repo/backend/convex/auth/username/plugin";
import {
  createGoogleUsernameFields,
  usernameOptions,
} from "@repo/backend/convex/auth/username/policy";
import authConfig from "@repo/backend/convex/auth.config";
import { siteUrl } from "@repo/backend/convex/utils/site";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import {
  anonymous,
  openAPI,
  organization,
  username,
} from "better-auth/plugins";
import { Effect } from "effect";

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
        enabled: true,
      },
    },
    databaseHooks: {
      user: {
        delete: {
          before: (user, context) => {
            if (!context) {
              return Promise.resolve();
            }

            return Effect.runPromise(
              cleanupAuthRelations(
                (input) => context.context.adapter.deleteMany(input),
                user
              )
            );
          },
        },
      },
    },
    plugins: [
      anonymous(),
      /*
       * generatedUsername() must run before Better Auth's username plugin so
       * Google-created users are normalized before username validation runs.
       * Source: better-auth@1.6.16/dist/plugins/username/index.mjs
       */
      generatedUsername(),
      username(usernameOptions),
      organization(),
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
