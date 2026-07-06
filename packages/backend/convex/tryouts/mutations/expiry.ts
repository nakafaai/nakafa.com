import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  expireAttempt,
  finalizeSectionAttempt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import { ConvexError, v } from "convex/values";

const EXPIRY_SWEEP_LIMIT = 50;

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;

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

    await expireAttempt(ctx, { attempt: attemptRow, now });
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
      await expireAttempt(ctx, { attempt: attemptRow, now });
      return null;
    }

    await finalizeSectionAttempt(ctx, {
      attempt: attemptRow,
      endReason: "time-expired",
      now,
      section: sectionRow,
    });

    return null;
  },
});

/** Reconciles missed try-out expiry jobs in bounded pages. */
export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const attempts = await ctx.db
      .query("tryoutAttempts")
      .withIndex("by_status_and_expiresAt", (q) =>
        q.eq("status", "in-progress").lt("expiresAt", now)
      )
      .take(EXPIRY_SWEEP_LIMIT);

    for (const attemptRow of attempts) {
      await expireAttempt(ctx, { attempt: attemptRow, now });
    }

    const sections = await ctx.db
      .query("tryoutSectionAttempts")
      .withIndex("by_status_and_expiresAt", (q) =>
        q.eq("status", "in-progress").lt("expiresAt", now)
      )
      .take(EXPIRY_SWEEP_LIMIT);

    for (const sectionRow of sections) {
      const attemptRow = await ctx.db.get(sectionRow.tryoutAttemptId);

      if (attemptRow?.status !== "in-progress") {
        continue;
      }

      if (now >= attemptRow.expiresAt) {
        await expireAttempt(ctx, { attempt: attemptRow, now });
        continue;
      }

      await finalizeSectionAttempt(ctx, {
        attempt: attemptRow,
        endReason: "time-expired",
        now,
        section: sectionRow,
      });
    }

    return null;
  },
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
