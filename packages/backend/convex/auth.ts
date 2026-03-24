import type { GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { internalAction, query } from "@repo/backend/convex/_generated/server";
import { authComponent } from "@repo/backend/convex/auth/client";
import authConfig from "@repo/backend/convex/auth.config";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { siteUrl } from "@repo/backend/convex/utils/site";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import {
  anonymous,
  openAPI,
  organization,
  username,
} from "better-auth/plugins";

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

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));

/**
 * Query to get current logged-in user.
 */
export const getCurrentUser = query({
  args: {},
  handler: (ctx) => getOptionalAppUser(ctx),
});

/**
 * Query to get any user by ID.
 */
export const getUserById = query({
  args: { userId: vv.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);

    if (!user) {
      return null;
    }

    return {
      image: user.image ?? undefined,
      name: user.name,
    };
  },
});

/**
 * https://labs.convex.dev/better-auth/experimental#static-jwks
 */
export const getLatestJwks = internalAction({
  args: {},
  handler: (ctx) => {
    const auth = createAuth(ctx);
    // This method is added by the Convex Better Auth plugin and is
    // available via `auth.api` only, not exposed as a route.
    return auth.api.getLatestJwks();
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();
