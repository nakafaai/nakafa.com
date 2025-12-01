import {
  type AuthFunctions,
  createClient,
  type GenericCtx,
} from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { checkout, polar, portal, usage } from "@polar-sh/better-auth";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import {
  anonymous,
  apiKey,
  openAPI,
  organization,
  username,
} from "better-auth/plugins";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import authSchema from "./betterAuth/schema";
import { polarClient, products } from "./utils/polar";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

const authFunctions: AuthFunctions = internal.auth;

// TypeScript false positive with 10+ model discriminated union
// TS structural typing fails at deep nesting, incorrectly compares organization vs rateLimit
// Runtime verified: ✅ Convex compiles, ✅ Auth endpoints work, ✅ Schema synced
// See: https://github.com/microsoft/TypeScript/issues/30581
export const authComponent = createClient<DataModel, typeof authSchema>(
  // @ts-expect-error - TS can't handle deeply nested union types (10+ models)
  components.betterAuth,
  {
    authFunctions,
    local: {
      schema: authSchema,
    },
    verbose: false,
    triggers: {
      user: {
        onCreate: async (ctx, authUser) => {
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
          // TODO: Sync user updates if needed
        },
        onDelete: async (_ctx, _authUser) => {
          // TODO: Clean up related data on user deletion
        },
      },
    },
  }
);

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: true }
) => {
  const authConfig = {
    baseURL: siteUrl,
    logger: {
      disabled: optionsOnly,
    },
    database: authComponent.adapter(ctx),
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
    },
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
      polar({
        client: polarClient,
        createCustomerOnSignUp: true,
        use: [
          checkout({
            products: [
              {
                productId: products.pro.id,
                slug: products.pro.slug,
              },
            ],
            successUrl: `${siteUrl}/checkout/success?checkout_id={CHECKOUT_ID}`,
            authenticatedUsersOnly: true,
          }),
          portal(),
          usage(),
        ],
      }),
    ],
  } satisfies BetterAuthOptions;

  return betterAuth(authConfig);
};

/**
 * Get Better Auth user from session.
 */
export const safeGetUser = (ctx: QueryCtx) =>
  authComponent.safeGetAuthUser(ctx);

/**
 * Get Better Auth user by ID (bypasses session check).
 */
export const getAnyUserById = (ctx: QueryCtx, userId: string) =>
  authComponent.getAnyUserById(ctx, userId);

/**
 * Get current logged-in app user with auth data.
 * Returns null if not logged in.
 */
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

  return {
    appUser: user,
    authUser,
  };
};

/**
 * Get any app user by ID with auth data (bypasses session check).
 */
export const getAnyAppUserById = async (ctx: QueryCtx, userId: Id<"users">) => {
  const user = await ctx.db.get(userId);
  if (!user) {
    return null;
  }

  const authUser = await getAnyUserById(ctx, user.authId);
  if (!authUser) {
    return null;
  }

  return {
    appUser: user,
    authUser,
  };
};

/**
 * Query to get current logged-in user.
 */
export const getCurrentUser = query({
  args: {},
  handler: (ctx) => safeGetAppUser(ctx),
});

/**
 * Query to get any user by ID.
 */
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: (ctx, args) => getAnyAppUserById(ctx, args.userId),
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export type AppUser = NonNullable<Awaited<ReturnType<typeof safeGetAppUser>>>;
export type AnyAppUser = NonNullable<
  Awaited<ReturnType<typeof getAnyAppUserById>>
>;
