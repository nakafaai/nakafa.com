import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  expireAttemptAtEffectiveTime,
  finalizeSectionAttempt,
  getAttemptExpiresAt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import { requireOwnedAttempt } from "@repo/backend/convex/tryouts/runtime/score";
import { startSectionAttempt } from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";

const SECTION_COMPLETED_RESULT = "completed";
const SECTION_STARTED_RESULT = "started";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;
type TryoutEndReason = NonNullable<TryoutAttempt["endReason"]>;

/** Returns the stable mutation result for a completed section. */
function sectionCompletedResult(): { kind: "completed" } {
  return { kind: SECTION_COMPLETED_RESULT };
}

/** Returns the submitted or expired end reason for a section timer. */
function getSectionEndReason(
  section: TryoutSectionAttempt,
  now: number
): TryoutEndReason {
  if (now >= section.expiresAt) {
    return "time-expired";
  }

  return "submitted";
}

/** Loads one active section attempt by its stable section key. */
async function requireActiveSectionAttempt(
  ctx: MutationCtx,
  args: { attempt: TryoutAttempt; sectionKey: string }
) {
  const section = await ctx.db
    .query("tryoutSectionAttempts")
    .withIndex("by_tryoutAttemptId_and_sectionKey", (q) =>
      q
        .eq("tryoutAttemptId", args.attempt._id)
        .eq("sectionKey", args.sectionKey)
    )
    .unique();

  if (section?.status !== "in-progress") {
    throw new ConvexError({
      code: "TRYOUT_SECTION_NOT_ACTIVE",
      message: "Try-out section is not active.",
    });
  }

  return section;
}

/** Starts one section attempt and its timer inside an active try-out attempt. */
export const start = mutation({
  args: {
    attemptId: v.id("tryoutAttempts"),
    sectionKey: tryoutRouteKeyValidator,
  },
  returns: v.object({
    kind: v.literal(SECTION_STARTED_RESULT),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const attempt = await requireOwnedAttempt(ctx, {
      attemptId: args.attemptId,
      userId: appUser._id,
    });
    const now = Date.now();

    return startSectionAttempt(ctx, {
      attempt,
      now,
      sectionKey: args.sectionKey,
    });
  },
});

/** Completes one section and finalizes the attempt when no sections remain. */
export const complete = mutation({
  args: {
    attemptId: v.id("tryoutAttempts"),
    sectionKey: tryoutRouteKeyValidator,
  },
  returns: v.object({
    kind: v.literal(SECTION_COMPLETED_RESULT),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const attempt = await requireOwnedAttempt(ctx, {
      attemptId: args.attemptId,
      userId: appUser._id,
    });

    if (attempt.status !== "in-progress") {
      throw new ConvexError({
        code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
        message: "Try-out attempt is not active.",
      });
    }

    const now = Date.now();

    if (now >= getAttemptExpiresAt(attempt)) {
      await expireAttemptAtEffectiveTime(ctx, { attempt, now });
      throw new ConvexError({
        code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
        message: "Try-out attempt time has expired.",
      });
    }

    const section = await requireActiveSectionAttempt(ctx, {
      attempt,
      sectionKey: args.sectionKey,
    });
    const endReason = getSectionEndReason(section, now);

    await finalizeSectionAttempt(ctx, {
      attempt,
      endReason,
      now,
      section,
    });

    return sectionCompletedResult();
  },
});
