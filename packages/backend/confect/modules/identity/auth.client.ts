import { Ref } from "@confect/core";
import { createClient } from "@convex-dev/better-auth";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
  getCurrentCreditResetTimestamp,
} from "@repo/backend/confect/modules/commerce/credits.policy";
import { captureProductEvent } from "@repo/backend/confect/modules/integrations/analytics";
import { components } from "@repo/backend/confect/modules/integrations/convexComponents";
import { posthog } from "@repo/backend/confect/modules/integrations/posthog";
import type { ConvexDataModel } from "@repo/backend/confect/modules/shared/convexContext";
import { Clock, Effect } from "effect";

const authFunctions = {
  onCreate: Ref.getFunctionReference(refs.internal.auth.onCreate),
  onDelete: Ref.getFunctionReference(refs.internal.auth.onDelete),
  onUpdate: Ref.getFunctionReference(refs.internal.auth.onUpdate),
};

/** Better Auth component client and app-user synchronization adapter. */
export const authComponent = createClient<ConvexDataModel>(
  components.betterAuth,
  {
    authFunctions,
    verbose: false,
    triggers: {
      user: {
        onCreate: async (ctx, authUser) => {
          const now = await Effect.runPromise(Clock.currentTimeMillis);
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
          await authComponent.setUserId(ctx, authUser._id, userId);
          await ctx.scheduler.runAfter(
            0,
            Ref.getFunctionReference(
              refs.internal.customers.actions.internalFunctions.syncCustomer
            ),
            {
              userId,
            }
          );
          await ctx.scheduler.runAfter(
            0,
            Ref.getFunctionReference(
              refs.internal.emails.mutations.sendWelcomeEmail
            ),
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
            Ref.getFunctionReference(
              refs.internal.customers.actions.internalFunctions.syncCustomer
            ),
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
            Ref.getFunctionReference(
              refs.internal.auth.cleanup.cleanupDeletedUser
            ),
            {
              userId: userApp._id,
            }
          );
          await ctx.scheduler.runAfter(
            0,
            Ref.getFunctionReference(
              refs.internal.customers.actions.internalFunctions.cleanupUserData
            ),
            { userId: userApp._id }
          );
        },
      },
    },
  }
);
