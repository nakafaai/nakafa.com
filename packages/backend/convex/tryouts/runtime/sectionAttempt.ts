import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TryoutRuntimeError,
  tryRuntimePromise,
  tryRuntimeSync,
} from "@repo/backend/convex/tryouts/runtime/error";
import {
  finalizeSectionAttempt,
  getAttemptExpiresAt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import { requireSectionSnapshot } from "@repo/backend/convex/tryouts/runtime/placement";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
interface InternalEntrySection {
  readonly sectionKey: string;
  readonly visibility: "internal-entry" | "visible";
}

const expireSectionReference = makeFunctionReference<
  "mutation",
  { expiresAt: number; sectionAttemptId: Id<"tryoutSectionAttempts"> },
  null
>("tryouts/mutations/expiry:section");
const startSectionResult = Object.freeze({ kind: "started" });

/** Ensures atomic section start is only used for a set-owned internal entry. */
export function requireInternalEntrySection(
  sections: readonly InternalEntrySection[],
  sectionKey: string
) {
  const section = sections.find((row) => row.sectionKey === sectionKey);

  if (section?.visibility !== "internal-entry") {
    throw new ConvexError({
      code: "TRYOUT_ENTRY_SECTION_NOT_FOUND",
      message: "Try-out entry section is not available for this set.",
    });
  }
}

/** Resolves the timer row that authorizes answers for one placement. */
export function loadPlacementSectionAttempt(
  ctx: MutationCtx,
  placement: Doc<"tryoutAttemptPlacements">
) {
  return ctx.db
    .query("tryoutSectionAttempts")
    .withIndex("by_tryoutAttemptId_and_sectionKey", (q) =>
      q
        .eq("tryoutAttemptId", placement.tryoutAttemptId)
        .eq("sectionKey", placement.sectionKey)
    )
    .unique();
}

/** Starts one section attempt and its timer inside an active try-out attempt. */
export const startSectionAttempt = Effect.fn(
  "tryouts.runtime.startSectionAttempt"
)(function* (
  ctx: MutationCtx,
  args: { attempt: TryoutAttempt; now: number; sectionKey: string }
) {
  if (args.attempt.status !== "in-progress") {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt is not active.",
    });
  }

  if (args.now >= getAttemptExpiresAt(args.attempt)) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt time has expired.",
    });
  }

  const existing = yield* tryRuntimePromise(() =>
    loadSectionAttempt(ctx, args)
  );

  if (existing?.status === "in-progress" && args.now < existing.expiresAt) {
    return startSectionResult;
  }

  if (existing?.status === "in-progress") {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_SECTION_NOT_ACTIVE",
      message: "Try-out section time has expired.",
    });
  }

  if (existing) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_SECTION_ALREADY_FINISHED",
      message: "Try-out section already finished.",
    });
  }

  const currentAttempt = yield* requireNoParallelSectionTimer(ctx, args);
  const snapshot = yield* tryRuntimeSync(() =>
    requireSectionSnapshot(currentAttempt, args.sectionKey)
  );
  const expiresAt = Math.min(
    args.now + snapshot.timeLimitSeconds * 1000,
    getAttemptExpiresAt(currentAttempt)
  );
  const sectionAttemptId = yield* tryRuntimePromise(() =>
    ctx.db.insert("tryoutSectionAttempts", {
      answeredCount: 0,
      completedAt: null,
      correctAnswers: 0,
      endReason: null,
      expiresAt,
      lastActivityAt: args.now,
      sectionIdentity: snapshot.sectionIdentity,
      sectionKey: snapshot.sectionKey,
      sectionOrder: snapshot.sectionOrder,
      startedAt: args.now,
      status: "in-progress",
      totalQuestions: snapshot.questionCount,
      tryoutAttemptId: currentAttempt._id,
    })
  );
  const sectionAttempt = yield* tryRuntimePromise(() =>
    ctx.db.get(sectionAttemptId)
  );

  if (!sectionAttempt) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_SECTION_NOT_FOUND",
      message: "Try-out section attempt not found.",
    });
  }

  yield* tryRuntimePromise(() =>
    ctx.db.patch(currentAttempt._id, {
      lastActivityAt: args.now,
    })
  );
  yield* tryRuntimePromise(() =>
    ctx.scheduler.runAfter(
      Math.max(0, expiresAt - args.now),
      expireSectionReference,
      { expiresAt, sectionAttemptId }
    )
  );

  return startSectionResult;
});

/** Loads one existing section attempt by its stable section key. */
function loadSectionAttempt(
  ctx: MutationCtx,
  args: { attempt: TryoutAttempt; sectionKey: string }
) {
  return ctx.db
    .query("tryoutSectionAttempts")
    .withIndex("by_tryoutAttemptId_and_sectionKey", (q) =>
      q
        .eq("tryoutAttemptId", args.attempt._id)
        .eq("sectionKey", args.sectionKey)
    )
    .unique();
}

/** Loads all section attempts for one attempt snapshot. */
async function loadSectionAttempts(ctx: MutationCtx, attempt: TryoutAttempt) {
  const sections = await ctx.db
    .query("tryoutSectionAttempts")
    .withIndex("by_tryoutAttemptId_and_sectionOrder", (q) =>
      q.eq("tryoutAttemptId", attempt._id)
    )
    .take(attempt.sectionSnapshots.length + 1);

  if (sections.length > attempt.sectionSnapshots.length) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_ATTEMPT_COUNT_EXCEEDED",
      message: "Try-out section attempt count exceeds the attempt snapshot.",
    });
  }

  return sections;
}

/** Rejects or expires any other in-progress section timer. */
const requireNoParallelSectionTimer = Effect.fn(
  "tryouts.runtime.requireNoParallelSectionTimer"
)(function* (
  ctx: MutationCtx,
  args: { attempt: TryoutAttempt; now: number; sectionKey: string }
) {
  const sections = yield* tryRuntimePromise(() =>
    loadSectionAttempts(ctx, args.attempt)
  );

  for (const section of sections) {
    if (section.sectionKey === args.sectionKey) {
      continue;
    }

    if (section.status !== "in-progress") {
      continue;
    }

    if (args.now >= section.expiresAt) {
      yield* finalizeSectionAttempt(ctx, {
        attempt: args.attempt,
        endReason: "time-expired",
        now: args.now,
        section,
      });
      continue;
    }

    return yield* new TryoutRuntimeError({
      code: "TRYOUT_SECTION_IN_PROGRESS",
      message: "Another try-out section is already in progress.",
    });
  }

  const currentAttempt = yield* tryRuntimePromise(() =>
    ctx.db.get(args.attempt._id)
  );

  if (currentAttempt?.status !== "in-progress") {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt is not active.",
    });
  }

  return currentAttempt;
});
