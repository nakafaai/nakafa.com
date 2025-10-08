import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import {
  anonymous,
  apiKey,
  openAPI,
  organization,
  username,
} from "better-auth/plugins";
import { v } from "convex/values";
import { withoutSystemFields } from "convex-helpers";
import { components } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import authSchema from "./betterAuth/schema";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: {
      schema: authSchema,
    },
    verbose: true,
    triggers: {
      user: {
        onCreate: async (ctx, authUser) => {
          // Handle user creation logic here if needed
          // This is where you can sync changes to your application user table
          const userId = await ctx.db.insert("users", {
            email: authUser.email,
            authId: authUser._id,
          });
          await ctx.runMutation(components.betterAuth.auth.setUserId, {
            authId: authUser._id,
            userId,
          });
        },
        onUpdate: async (_ctx, _newDoc, _oldDoc) => {
          // Handle user update logic here if needed
          // This is where you can sync changes to your application user table
        },
        onDelete: async (_ctx, _authUser) => {
          // Handle user deletion logic here if needed
          // This is where you can clean up related data
        },
      },
    },
  }
);

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false }
): ReturnType<typeof betterAuth> => {
  const authConfig = {
    baseURL: siteUrl,
    logger: {
      disabled: optionsOnly,
    },
    database: authComponent.adapter(ctx),
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: true,
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: process.env.AUTH_GOOGLE_ID as string,
        clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
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
      apiKey(),
      openAPI(),
      convex(),
    ],
  } satisfies BetterAuthOptions;

  return betterAuth(authConfig);
};

export const safeGetUser = (ctx: QueryCtx) =>
  authComponent.safeGetAuthUser(ctx);

export const getAnyUserById = (ctx: QueryCtx, userId: string) =>
  authComponent.getAnyUserById(ctx, userId);

// Get the current app user (not Better Auth user)
export const safeGetAppUser = async (ctx: QueryCtx) => {
  const authUser = await safeGetUser(ctx);
  if (!authUser) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("authId", (q) => q.eq("authId", authUser._id))
    .unique();
  if (!user) {
    return null;
  }

  return { ...user, ...withoutSystemFields(authUser) };
};

export const getAnyAppUserById = async (ctx: QueryCtx, userId: Id<"users">) => {
  const user = await ctx.db.get(userId);
  if (!user) {
    return null;
  }

  const authUser = await getAnyUserById(ctx, user.authId);
  if (!authUser) {
    return null;
  }

  return { ...user, ...withoutSystemFields(authUser) };
};

export const getCurrentUser = query({
  args: {},
  handler: (ctx) => safeGetAppUser(ctx),
});

export const getUserById = query({
  args: { userId: v.id("users") },
  handler: (ctx, args) => getAnyAppUserById(ctx, args.userId),
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export type AppUser = NonNullable<Awaited<ReturnType<typeof safeGetAppUser>>>;
export type AnyAppUser = NonNullable<
  Awaited<ReturnType<typeof getAnyAppUserById>>
>;
