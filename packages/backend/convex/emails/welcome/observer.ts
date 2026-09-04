import { internal } from "@repo/backend/convex/_generated/api";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { tryWelcomeIntent } from "@repo/backend/convex/emails/welcome/impl";
import { legacyWelcomePageOptions } from "@repo/backend/convex/emails/welcome/migration";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getFunctionName } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

/**
 * Convex stores the compiled module path in `_scheduled_functions.name`.
 * https://docs.convex.dev/scheduling/scheduled-functions#retrieving-scheduled-function-status
 */
function toCompiledScheduledFunctionName(sourceName: string) {
  return sourceName.replace(":", ".js:");
}

const LEGACY_WELCOME_JOB_NAME = toCompiledScheduledFunctionName(
  getFunctionName(internal.emails.delivery.sendWelcomeEmail)
);
const legacyWelcomeJobCounts = {
  canceled: v.number(),
  failed: v.number(),
  inProgress: v.number(),
  pending: v.number(),
  success: v.number(),
};

const observeLegacyWelcomeJobsProgram = Effect.fn(
  "emails.welcome.observer.observeLegacyJobs"
)(function* (ctx: QueryCtx, cursor: string | null) {
  const page = yield* tryWelcomeIntent(() =>
    ctx.db.system
      .query("_scheduled_functions")
      .paginate(legacyWelcomePageOptions(cursor))
  );
  const counts = {
    canceled: 0,
    failed: 0,
    inProgress: 0,
    pending: 0,
    success: 0,
  };
  for (const job of page.page) {
    if (job.name === LEGACY_WELCOME_JOB_NAME) {
      counts[job.state.kind] += 1;
    }
  }
  return {
    ...counts,
    continueCursor: page.isDone ? null : page.continueCursor,
    isDone: page.isDone,
  };
});

/** Returns one bounded aggregate-only page of legacy scheduled-job state. */
export const observeLegacyWelcomeJobs = internalQuery({
  args: { cursor: v.union(v.null(), v.string()) },
  returns: v.object({
    ...legacyWelcomeJobCounts,
    continueCursor: v.union(v.null(), v.string()),
    isDone: v.boolean(),
  }),
  handler: (ctx, { cursor }) =>
    runConvexProgram(observeLegacyWelcomeJobsProgram(ctx, cursor)),
});
