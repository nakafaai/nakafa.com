import { internal } from "@repo/backend/convex/_generated/api";
import { POSTHOG_DELETION_RECONCILIATION_DELAY_MS } from "@repo/backend/convex/analytics/deletion";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

const DELETED_USER_CLEANUP_RETRY = {
  base: 2,
  initialBackoffMs: 1000,
  maxAttempts: 10,
};

/** Erases analytics independently from every local and external data drain. */
export const cleanupDeletedUserAnalytics = workflow.define({
  args: {
    userId: vv.id("users"),
  },
  returns: v.null(),
  handler: async (step, args) => {
    await step.runAction(
      internal.analytics.deletion.cleanupDeletedUserAnalytics,
      { userId: args.userId },
      { retry: DELETED_USER_CLEANUP_RETRY }
    );
    await step.runAction(
      internal.analytics.deletion.cleanupDeletedUserAnalytics,
      { userId: args.userId },
      {
        name: "reconcile late analytics writes",
        retry: DELETED_USER_CLEANUP_RETRY,
        runAfter: POSTHOG_DELETION_RECONCILIATION_DELAY_MS,
      }
    );

    return null;
  },
});

/** Erases the external billing customer without gating Nakafa data cleanup. */
export const cleanupDeletedUserCustomer = workflow.define({
  args: {
    authId: v.string(),
    userId: vv.id("users"),
  },
  returns: v.null(),
  handler: async (step, args) => {
    await step.runAction(
      internal.customers.actions.internal.cleanupDeletedUserCustomerData,
      {
        authId: args.authId,
        userId: args.userId,
      },
      { retry: DELETED_USER_CLEANUP_RETRY }
    );

    return null;
  },
});

/** Erases Nakafa-owned personal data without an external dependency. */
export const cleanupDeletedUserData = workflow.define({
  args: {
    userId: vv.id("users"),
  },
  returns: v.null(),
  handler: async (step, args) => {
    await step.runAction(
      internal.auth.cleanup.drainDeletedUserData,
      { userId: args.userId },
      { retry: DELETED_USER_CLEANUP_RETRY }
    );

    return null;
  },
});
