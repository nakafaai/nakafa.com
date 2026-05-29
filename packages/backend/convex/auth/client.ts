import { type AuthFunctions, createClient } from "@convex-dev/better-auth";
import { components, internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import authSchema from "@repo/backend/convex/betterAuth/schema";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/convex/credits/constants";
import { getCurrentCreditResetTimestamp } from "@repo/backend/convex/credits/helpers/state";
import { posthog } from "@repo/backend/convex/posthog";

const authFunctions: AuthFunctions = internal.auth.lifecycle;

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
          const now = Date.now();
          const signedUpAt = new Date(now).toISOString();
          const userId = await ctx.db.insert("users", {
            email: authUser.email,
            authId: authUser._id,
            name: authUser.name,
            image: authUser.image ?? undefined,
            plan: DEFAULT_USER_PLAN,
            credits: DEFAULT_USER_CREDITS,
            creditsResetAt: getCurrentCreditResetTimestamp(
              DEFAULT_USER_PLAN,
              now
            ),
          });

          await ctx.db.insert("notificationPreferences", {
            disabledTypes: [],
            userId,
            emailEnabled: true,
            emailDigest: "weekly",
            updatedAt: now,
          });

          await ctx.db.insert("notificationCounts", {
            userId,
            unreadCount: 0,
            updatedAt: now,
          });

          await posthog.identify(ctx, {
            distinctId: userId,
            disableGeoip: true,
            properties: {
              $set: {
                email: authUser.email,
                name: authUser.name,
                plan: DEFAULT_USER_PLAN,
              },
              $set_once: {
                signed_up_at: signedUpAt,
              },
            },
          });

          await captureProductEvent(ctx, {
            distinctId: userId,
            event: {
              name: "user signed up",
              properties: {
                plan: DEFAULT_USER_PLAN,
              },
            },
            timestamp: new Date(now),
          });

          await ctx.runMutation(components.betterAuth.mutations.setUserId, {
            authId: authUser._id,
            userId,
          });

          await ctx.scheduler.runAfter(
            0,
            internal.customers.actions.internal.syncCustomer,
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
            internal.customers.actions.internal.syncCustomer,
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
            internal.customers.actions.internal.cleanupUserData,
            { userId: userApp._id }
          );
        },
      },
    },
  }
);
