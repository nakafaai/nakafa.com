import type { GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { authComponent } from "@repo/backend/convex/auth/client";
import authConfig from "@repo/backend/convex/auth.config";
import { siteUrl } from "@repo/backend/convex/utils/site";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import {
  anonymous,
  openAPI,
  organization,
  username,
} from "better-auth/plugins";

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
        mapProfileToUser: (profile) => ({
          username: profile.email,
          displayUsername: profile.email.split("@")[0],
        }),
      },
    },
    user: {
      deleteUser: {
        enabled: true,
      },
    },
    plugins: [
      anonymous(),
      username(),
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
