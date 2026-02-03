import {
  type AuthFunctions,
  createClient,
  type GenericCtx,
} from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components, internal } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";
import {
  internalAction,
  type QueryCtx,
  query,
} from "@repo/backend/convex/_generated/server";
import authConfig from "@repo/backend/convex/auth.config";
import authSchema from "@repo/backend/convex/betterAuth/schema";
import { vv } from "@repo/backend/convex/lib/validators";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import {
  anonymous,
  apiKey,
  openAPI,
  organization,
  username,
} from "better-auth/plugins";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel, typeof authSchema>(
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
          // Create app user with denormalized auth data
          const userId = await ctx.db.insert("users", {
            email: authUser.email,
            authId: authUser._id,
            name: authUser.name,
            image: authUser.image ?? undefined,
          });

          // Create default notification preferences
          await ctx.db.insert("notificationPreferences", {
            userId,
            emailEnabled: true,
            emailDigest: "weekly",
            disabledTypes: [],
            mutedEntities: [],
            updatedAt: Date.now(),
          });

          await ctx.runMutation(components.betterAuth.mutations.setUserId, {
            authId: authUser._id,
            userId,
          });

          // Sync customer to Polar and local DB
          await ctx.scheduler.runAfter(
            0,
            internal.customers.actions.syncCustomer,
            { userId }
          );

          // Send welcome email
          await ctx.scheduler.runAfter(
            0,
            internal.emails.mutations.sendWelcomeEmail,
            {
              name: authUser.name,
              email: authUser.email,
            }
          );
        },
        onUpdate: async (ctx, newDoc, oldDoc) => {
          // Sync name/image changes to app user
          if (newDoc.name !== oldDoc.name || newDoc.image !== oldDoc.image) {
            const appUser = await ctx.db
              .query("users")
              .withIndex("authId", (q) => q.eq("authId", newDoc._id))
              .unique();
            if (appUser) {
              await ctx.db.patch("users", appUser._id, {
                name: newDoc.name,
                image: newDoc.image ?? undefined,
              });
            }
          }
        },
        onDelete: async (ctx, authUser) => {
          const userApp = await ctx.db
            .query("users")
            .withIndex("authId", (q) => q.eq("authId", authUser._id))
            .unique();

          if (userApp) {
            // Delete customer in Polar to prevent email conflicts
            await ctx.scheduler.runAfter(
              0,
              internal.customers.actions.cleanupUserData,
              { userId: userApp._id }
            );

            // Delete user data in local DB
            await ctx.db.delete("users", userApp._id);
          }
        },
      },
    },
  }
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    baseURL: siteUrl,
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
      apiKey(),
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
  const user = await ctx.db.get("users", userId);
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
  args: { userId: vv.id("users") },
  handler: (ctx, args) => getAnyAppUserById(ctx, args.userId),
});

/**
 * https://labs.convex.dev/better-auth/experimental#static-jwks
 */
export const getLatestJwks = internalAction({
  args: {},
  handler: async (ctx) => {
    const auth = createAuth(ctx);
    // This method is added by the Convex Better Auth plugin and is
    // available via `auth.api` only, not exposed as a route.
    return await auth.api.getLatestJwks();
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export type AppUser = NonNullable<Awaited<ReturnType<typeof safeGetAppUser>>>;
export type AnyAppUser = NonNullable<
  Awaited<ReturnType<typeof getAnyAppUserById>>
>;
