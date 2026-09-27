import { Scheduler } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import { components } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Duration, Effect } from "effect";
export const scheduleRetainedEmailCleanup = Effect.fn(
  "emails.retention.scheduleCleanup"
)(function* (ctx: MutationCtx) {
  const scheduler = yield* Scheduler.Scheduler.pipe(
    Effect.provide(Scheduler.layer(ctx.scheduler))
  );
  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(0, components.resend.lib.cleanupOldEmails, {})
  );
  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(0, components.resend.lib.cleanupAbandonedEmails, {})
  );
  yield* scheduler
    .runAfter(
      Duration.millis(0),
      refs.internal.emails.welcome.reconciliation
        .reconcileWelcomeIntentLifecycle,
      {
        cursor: null,
        phase: "scheduled",
      }
    )
    .pipe(Effect.orDie);
  return null;
});
