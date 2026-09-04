import { components } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const reconcileWelcomeIntentLifecycle = makeFunctionReference<
  "mutation",
  { cursor: string | null; phase: "scheduled" | "enqueued" },
  null
>("emails/welcome/reconciliation:reconcileWelcomeIntentLifecycle");

const scheduleRetainedEmailCleanup = Effect.fn(
  "emails.retention.scheduleCleanup"
)(function* (ctx: MutationCtx) {
  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(0, components.resend.lib.cleanupOldEmails, {})
  );
  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(0, components.resend.lib.cleanupAbandonedEmails, {})
  );
  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(0, reconcileWelcomeIntentLifecycle, {
      cursor: null,
      phase: "scheduled",
    })
  );

  return null;
});

/**
 * Applies component retention and releases terminal app-owned handles.
 *
 * The component owns both retention windows so Nakafa does not duplicate
 * processor-specific durations. This app does not use historical delivery
 * records after an email has been sent.
 */
export const cleanupRetainedEmailData = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) => runConvexProgram(scheduleRetainedEmailCleanup(ctx)),
});
