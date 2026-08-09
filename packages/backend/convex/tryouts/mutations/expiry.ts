import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { tryRuntimePromise } from "@repo/backend/convex/tryouts/runtime/error";
import {
  expireAttempt,
  finalizeSectionAttempt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { Effect } from "effect";

const EXPIRY_SWEEP_LIMIT = 50;
const EXPIRY_SWEEP_ATTEMPT_BYTES = 6 * 1024 * 1024;
const EXPIRY_SWEEP_SECTION_BYTES = 2 * 1024 * 1024;

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;

const attemptExpiryReference = makeFunctionReference<
  "mutation",
  { attemptId: Id<"tryoutAttempts">; expiresAt: number },
  null
>("tryouts/mutations/expiry:attempt");
const sectionExpiryReference = makeFunctionReference<
  "mutation",
  { expiresAt: number; sectionAttemptId: Id<"tryoutSectionAttempts"> },
  null
>("tryouts/mutations/expiry:section");
const attemptReconciliationReference = makeFunctionReference<
  "mutation",
  { before: number },
  null
>("tryouts/mutations/expiry:reconcileAttempts");
const sectionReconciliationReference = makeFunctionReference<
  "mutation",
  { before: number; scheduledAttemptIds: Id<"tryoutAttempts">[] },
  null
>("tryouts/mutations/expiry:reconcileSections");

/** Expires one overall try-out attempt at its scheduled deadline. */
export const attempt = internalMutation({
  args: {
    attemptId: v.id("tryoutAttempts"),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attemptRow = await ctx.db.get(args.attemptId);
    const now = Date.now();

    if (!shouldExpire(attemptRow, args.expiresAt, now)) {
      return null;
    }

    await runConvexProgram(expireAttempt(ctx, { attempt: attemptRow, now }));
    return null;
  },
});

/** Expires one section attempt at its scheduled section deadline. */
export const section = internalMutation({
  args: {
    expiresAt: v.number(),
    sectionAttemptId: v.id("tryoutSectionAttempts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sectionRow = await ctx.db.get(args.sectionAttemptId);
    const now = Date.now();

    if (!shouldExpire(sectionRow, args.expiresAt, now)) {
      return null;
    }

    const attemptRow = await ctx.db.get(sectionRow.tryoutAttemptId);

    if (!attemptRow) {
      throw new ConvexError({
        code: "TRYOUT_ATTEMPT_NOT_FOUND",
        message: "Try-out attempt not found.",
      });
    }

    if (attemptRow.status !== "in-progress") {
      return null;
    }

    if (now >= attemptRow.expiresAt) {
      await runConvexProgram(expireAttempt(ctx, { attempt: attemptRow, now }));
      return null;
    }

    await runConvexProgram(
      finalizeSectionAttempt(ctx, {
        attempt: attemptRow,
        endReason: "time-expired",
        now,
        section: sectionRow,
      })
    );

    return null;
  },
});

/** Reconciles missed try-out expiry jobs in bounded pages. */
export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await runConvexProgram(startExpiryReconciliation(ctx, Date.now()));
    return null;
  },
});

/** Starts one sequential, byte-bounded missed-expiry reconciliation. */
const startExpiryReconciliation = Effect.fn(
  "tryouts.expiry.startReconciliation"
)(function* (ctx: MutationCtx, before: number) {
  yield* tryRuntimePromise(() =>
    ctx.scheduler.runAfter(0, attemptReconciliationReference, { before })
  );
});

/** Queues missed attempt expiries before handing off section reconciliation. */
export const reconcileAttempts = internalMutation({
  args: { before: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(reconcileMissedAttemptExpiries(ctx, args.before));
    return null;
  },
});

const reconcileMissedAttemptExpiries = Effect.fn(
  "tryouts.expiry.reconcileMissedAttemptExpiries"
)(function* (ctx: MutationCtx, before: number) {
  const attemptPage = yield* tryRuntimePromise(() =>
    ctx.db
      .query("tryoutAttempts")
      .withIndex("by_status_and_expiresAt", (q) =>
        q.eq("status", "in-progress").lt("expiresAt", before)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: EXPIRY_SWEEP_ATTEMPT_BYTES,
        maximumRowsRead: EXPIRY_SWEEP_LIMIT,
        numItems: EXPIRY_SWEEP_LIMIT,
      })
  );

  yield* Effect.forEach(
    attemptPage.page,
    (attemptRow) =>
      tryRuntimePromise(() =>
        ctx.scheduler.runAfter(0, attemptExpiryReference, {
          attemptId: attemptRow._id,
          expiresAt: attemptRow.expiresAt,
        })
      ),
    { concurrency: "unbounded", discard: true }
  );
  const scheduledAttemptIds = attemptPage.page.map(
    (attemptRow) => attemptRow._id
  );
  yield* tryRuntimePromise(() =>
    ctx.scheduler.runAfter(0, sectionReconciliationReference, {
      before,
      scheduledAttemptIds,
    })
  );
});

/** Queues section expiries whose parent was not handled by the attempt phase. */
export const reconcileSections = internalMutation({
  args: {
    before: v.number(),
    scheduledAttemptIds: v.array(v.id("tryoutAttempts")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      reconcileMissedSectionExpiries(ctx, {
        before: args.before,
        scheduledAttemptIds: args.scheduledAttemptIds,
      })
    );
    return null;
  },
});

const reconcileMissedSectionExpiries = Effect.fn(
  "tryouts.expiry.reconcileMissedSectionExpiries"
)(function* (
  ctx: MutationCtx,
  args: {
    before: number;
    scheduledAttemptIds: Id<"tryoutAttempts">[];
  }
) {
  const sectionPage = yield* tryRuntimePromise(() =>
    ctx.db
      .query("tryoutSectionAttempts")
      .withIndex("by_status_and_expiresAt", (q) =>
        q.eq("status", "in-progress").lt("expiresAt", args.before)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: EXPIRY_SWEEP_SECTION_BYTES,
        maximumRowsRead: EXPIRY_SWEEP_LIMIT,
        numItems: EXPIRY_SWEEP_LIMIT,
      })
  );
  const scheduledAttemptIds = new Set(args.scheduledAttemptIds);
  yield* Effect.forEach(
    sectionPage.page.filter(
      (sectionRow) => !scheduledAttemptIds.has(sectionRow.tryoutAttemptId)
    ),
    (sectionRow) =>
      tryRuntimePromise(() =>
        ctx.scheduler.runAfter(0, sectionExpiryReference, {
          expiresAt: sectionRow.expiresAt,
          sectionAttemptId: sectionRow._id,
        })
      ),
    { concurrency: "unbounded", discard: true }
  );
});

/** Returns true when a scheduled expiry job still matches an active row. */
function shouldExpire<Row extends TryoutAttempt | TryoutSectionAttempt>(
  row: Row | null,
  scheduledExpiresAt: number,
  now: number
): row is Row {
  return Boolean(
    row &&
      row.status === "in-progress" &&
      row.expiresAt === scheduledExpiresAt &&
      now >= row.expiresAt
  );
}
