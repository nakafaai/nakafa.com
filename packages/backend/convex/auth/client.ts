import { type AuthFunctions, createClient } from "@convex-dev/better-auth";
import { components, internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import authSchema from "@repo/backend/convex/betterAuth/schema";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/convex/credits/constants";

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
          const userId = await ctx.db.insert("users", {
            email: authUser.email,
            authId: authUser._id,
            name: authUser.name,
            image: authUser.image ?? undefined,
            plan: DEFAULT_USER_PLAN,
            credits: DEFAULT_USER_CREDITS,
            creditsResetAt: Date.now(),
          });

          await ctx.db.insert("notificationPreferences", {
            disabledTypes: [],
            userId,
            emailEnabled: true,
            emailDigest: "weekly",
            updatedAt: Date.now(),
          });

          await ctx.db.insert("notificationCounts", {
            userId,
            unreadCount: 0,
            updatedAt: Date.now(),
          });

          await ctx.runMutation(components.betterAuth.mutations.setUserId, {
            authId: authUser._id,
            userId,
          });

          await ctx.scheduler.runAfter(
            0,
            internal.customers.actions.syncCustomer,
            {
              userId,
            }
          );

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
          const hasProfileChanges =
            newDoc.name !== oldDoc.name ||
            newDoc.image !== oldDoc.image ||
            newDoc.email !== oldDoc.email;

          if (!hasProfileChanges) {
            return;
          }

          const appUser = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", newDoc._id))
            .unique();

          if (!appUser) {
            return;
          }

          await ctx.db.patch("users", appUser._id, {
            email: newDoc.email,
            name: newDoc.name,
            image: newDoc.image ?? undefined,
          });

          await ctx.scheduler.runAfter(
            0,
            internal.customers.actions.syncCustomer,
            {
              userId: appUser._id,
            }
          );
        },
        onDelete: async (ctx, authUser) => {
          const userApp = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
            .unique();

          if (!userApp) {
            return;
          }

          await ctx.scheduler.runAfter(
            0,
            internal.auth.cleanup.cleanupDeletedUser,
            {
              userId: userApp._id,
            }
          );

          await ctx.scheduler.runAfter(
            0,
            internal.customers.actions.cleanupUserData,
            { userId: userApp._id }
          );
        },
      },
    },
  }
);
