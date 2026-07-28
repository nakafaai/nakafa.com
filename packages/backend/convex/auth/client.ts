import { type AuthFunctions, createClient } from "@convex-dev/better-auth";
import { components, internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import {
  captureProductEvent,
  identifyProductUser,
} from "@repo/backend/convex/analytics/capture";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/convex/auth/deletion/constants";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import authSchema from "@repo/backend/convex/betterAuth/schema";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/convex/credits/constants";
import { getCurrentCreditResetTimestamp } from "@repo/backend/convex/credits/helpers/state";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

const authFunctions: AuthFunctions = internal.auth.lifecycle;
const finalizeDeletedUserCleanupReference = makeFunctionReference<
  "mutation",
  { authId: string },
  null
>("customers/deletion/workflow:finalizeDeletedUserCleanup");

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

          await runConvexProgram(
            Effect.gen(function* () {
              yield* identifyProductUser(ctx, {
                distinctId: userId,
                email: authUser.email,
                name: authUser.name,
                plan: DEFAULT_USER_PLAN,
                signedUpAt,
              });
              yield* captureProductEvent(ctx, {
                distinctId: userId,
                event: {
                  name: "user signed up",
                  properties: {
                    plan: DEFAULT_USER_PLAN,
                  },
                },
                timestamp: new Date(now),
              });
            })
          );

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
              userId,
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

          if (!appUser || isAccountDeletionPending(appUser)) {
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
          await ctx.scheduler.runAfter(0, finalizeDeletedUserCleanupReference, {
            authId: authUser._id,
          });
          await ctx.scheduler.runAfter(
            ACCOUNT_DELETION_RECOVERY_DELAY_MS,
            finalizeDeletedUserCleanupReference,
            {
              authId: authUser._id,
            }
          );
        },
      },
    },
  }
);
