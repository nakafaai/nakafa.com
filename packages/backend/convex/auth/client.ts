import { type AuthFunctions, createClient } from "@convex-dev/better-auth";
import { components, internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import authSchema from "@repo/backend/convex/betterAuth/schema";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
  getCurrentCreditResetTimestamp,
} from "@repo/backend/convex/credits/constants";
import { userWriteWorkpool } from "@repo/backend/convex/users/workpool";

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
            authId: authUser._id,
            credits: DEFAULT_USER_CREDITS,
            creditsResetAt: getCurrentCreditResetTimestamp(DEFAULT_USER_PLAN),
            email: authUser.email,
            image: authUser.image ?? undefined,
            name: authUser.name,
            plan: DEFAULT_USER_PLAN,
          });

          await ctx.db.insert("notificationPreferences", {
            disabledTypes: [],
            emailDigest: "weekly",
            emailEnabled: true,
            updatedAt: Date.now(),
            userId,
          });

          await ctx.db.insert("notificationCounts", {
            unreadCount: 0,
            updatedAt: Date.now(),
            userId,
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

          await userWriteWorkpool.enqueueMutation(
            ctx,
            internal.users.mutations.applyUserStateUpdate,
            {
              clearImage: newDoc.image === null,
              email: newDoc.email,
              image: newDoc.image ?? undefined,
              name: newDoc.name,
              syncCustomerAfter: true,
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
