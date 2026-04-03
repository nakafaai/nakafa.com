import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  requireActiveTryoutAttemptAfterExpirySync,
  requireOwnedTryoutAttempt,
} from "@repo/backend/convex/tryouts/helpers/access";
import { syncTryoutAttemptExpiry } from "@repo/backend/convex/tryouts/helpers/expiry";
import { finalizeTryoutAttempt } from "@repo/backend/convex/tryouts/helpers/finalize/attempt";
import { finalizeTryoutPartAttempt } from "@repo/backend/convex/tryouts/helpers/finalize/part";
import { getFirstIncompleteTryoutPartIndex } from "@repo/backend/convex/tryouts/helpers/metrics";
import {
  loadValidatedTryoutPartSets,
  resolveRequestedTryoutPart,
} from "@repo/backend/convex/tryouts/helpers/parts";
import { ConvexError } from "convex/values";

/** Load one active tryout by product, locale, and slug. */
export async function loadStartableTryout(
  ctx: MutationCtx,
  args: {
    locale: Doc<"tryouts">["locale"];
    product: Doc<"tryouts">["product"];
    tryoutSlug: Doc<"tryouts">["slug"];
  }
) {
  const tryout = await ctx.db
    .query("tryouts")
    .withIndex("by_product_and_locale_and_slug", (q) =>
      q
        .eq("product", args.product)
        .eq("locale", args.locale)
        .eq("slug", args.tryoutSlug)
    )
    .unique();

  if (!tryout) {
    throw new ConvexError({
      code: "TRYOUT_NOT_FOUND",
      message: "Tryout not found.",
    });
  }

  if (!tryout.isActive) {
    throw new ConvexError({
      code: "TRYOUT_INACTIVE",
      message: "This tryout is not currently active.",
    });
  }

  return tryout;
}

/**
 * Reuse an existing in-progress attempt when it still has unfinished work, or
 * finalize it when every part is already complete.
 */
export async function reuseExistingTryoutAttempt(
  ctx: MutationCtx,
  {
    now,
    userId,
    tryoutAttempt,
  }: {
    now: number;
    userId: Doc<"users">["_id"];
    tryoutAttempt: Doc<"tryoutAttempts">;
  }
) {
  const tryoutExpiry = await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);

  if (tryoutExpiry.expired || tryoutAttempt.status !== "in-progress") {
    return false;
  }

  const firstIncompletePartIndex = getFirstIncompleteTryoutPartIndex({
    completedPartIndices: tryoutAttempt.completedPartIndices,
    partCount: tryoutAttempt.partSetSnapshots.length,
  });

  if (firstIncompletePartIndex !== undefined) {
    return true;
  }

  const completedAttempt = await finalizeTryoutAttempt({
    ctx,
    now,
    tryoutAttempt,
    userId,
  });

  if (completedAttempt.status !== "completed") {
    throw new ConvexError({
      code: "INVALID_TRYOUT_STATE",
      message: "Tryout has no incomplete part but could not be finalized.",
    });
  }

  return true;
}

/**
 * Load the tryout and historical snapshot needed to start one concrete tryout
 * part.
 *
 * Route resolution still accepts the current public part key, but the returned
 * part metadata stays bound to the persisted attempt snapshot so content-sync
 * changes never rewrite an in-progress attempt onto a different set.
 */
export async function loadPartStartContext(
  ctx: MutationCtx,
  {
    now,
    partKey,
    tryoutAttemptId,
    userId,
  }: {
    now: number;
    partKey: Doc<"tryoutPartAttempts">["partKey"];
    tryoutAttemptId: Doc<"tryoutAttempts">["_id"];
    userId: Doc<"users">["_id"];
  }
) {
  const tryoutAttempt = await requireOwnedTryoutAttempt(ctx, {
    tryoutAttemptId,
    userId,
  });
  const activeTryoutAttempt = await requireActiveTryoutAttemptAfterExpirySync(
    ctx,
    {
      now,
      tryoutAttempt,
    }
  );
  const tryout = await ctx.db.get("tryouts", activeTryoutAttempt.tryoutId);

  if (!tryout) {
    throw new ConvexError({
      code: "TRYOUT_NOT_FOUND",
      message: "Tryout not found.",
    });
  }

  const currentPartSets = await loadValidatedTryoutPartSets(ctx.db, {
    partCount: tryout.partCount,
    tryoutId: tryout._id,
  });
  const resolvedPart = resolveRequestedTryoutPart({
    currentPartSets,
    partSetSnapshots: activeTryoutAttempt.partSetSnapshots,
    requestedPartKey: partKey,
  });
  const tryoutPartSnapshot = resolvedPart?.snapshot ?? null;

  if (!tryoutPartSnapshot) {
    throw new ConvexError({
      code: "PART_NOT_FOUND",
      message: "Tryout part not found.",
    });
  }

  if (
    activeTryoutAttempt.completedPartIndices.includes(
      tryoutPartSnapshot.partIndex
    )
  ) {
    throw new ConvexError({
      code: "PART_ALREADY_COMPLETED",
      message: "This tryout part has already been completed.",
    });
  }

  return {
    tryout,
    tryoutPartSnapshot,
  };
}

/**
 * Reuse one existing in-progress part attempt, or finalize it as expired when
 * its underlying set attempt already timed out.
 */
export async function reuseExistingPartAttempt(
  ctx: MutationCtx,
  {
    now,
    partIndex,
    tryoutAttemptId,
  }: {
    now: number;
    partIndex: Doc<"tryoutPartAttempts">["partIndex"];
    tryoutAttemptId: Doc<"tryoutAttempts">["_id"];
  }
) {
  const existingPartAttempt = await ctx.db
    .query("tryoutPartAttempts")
    .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
      q.eq("tryoutAttemptId", tryoutAttemptId).eq("partIndex", partIndex)
    )
    .unique();

  if (!existingPartAttempt) {
    return false;
  }

  const existingSetAttempt = await ctx.db.get(
    "exerciseAttempts",
    existingPartAttempt.setAttemptId
  );

  if (!existingSetAttempt) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout part attempt exists without its exercise attempt.",
    });
  }

  if (existingSetAttempt.status !== "in-progress") {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout part state is out of sync with its tryout attempt.",
    });
  }

  const expiresAtMs =
    existingSetAttempt.startedAt + existingSetAttempt.timeLimit * 1000;

  if (now < expiresAtMs) {
    return true;
  }

  await finalizeTryoutPartAttempt({
    ctx,
    finishedAtMs: expiresAtMs,
    now,
    partAttempt: existingPartAttempt,
    status: "expired",
    tryoutAttemptId,
  });

  throw new ConvexError({
    code: "TRYOUT_PART_EXPIRED",
    message: "This tryout part has already expired.",
  });
}

/** Load one set and enforce the start-time question-count invariant. */
export async function loadStartableSet(
  ctx: MutationCtx,
  setId: Doc<"exerciseSets">["_id"]
) {
  const set = await ctx.db.get("exerciseSets", setId);

  if (!set) {
    throw new ConvexError({
      code: "SET_NOT_FOUND",
      message: "Exercise set not found.",
    });
  }

  if (set.questionCount <= 0) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "questionCount must be greater than 0.",
    });
  }

  return set;
}

/** Load the persisted part-attempt row for one tryout attempt and part key. */
export async function loadTryoutPartAttempt(
  ctx: MutationCtx,
  {
    partIndex,
    tryoutAttemptId,
  }: {
    partIndex: Doc<"tryoutPartAttempts">["partIndex"];
    tryoutAttemptId: Doc<"tryoutAttempts">["_id"];
  }
) {
  const partAttempt = await ctx.db
    .query("tryoutPartAttempts")
    .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
      q.eq("tryoutAttemptId", tryoutAttemptId).eq("partIndex", partIndex)
    )
    .unique();

  if (!partAttempt) {
    throw new ConvexError({
      code: "PART_ATTEMPT_NOT_FOUND",
      message: "Tryout part attempt not found.",
    });
  }

  return partAttempt;
}
