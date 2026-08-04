import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TryoutRuntimeError,
  tryRuntimePromise,
} from "@repo/backend/convex/tryouts/runtime/error";
import { getSectionScoreSnapshot } from "@repo/backend/convex/tryouts/runtime/result";
import {
  finalizeAttemptScore,
  scoreTryoutSection,
  summarizeResponses,
} from "@repo/backend/convex/tryouts/runtime/score";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;
type TryoutEndReason = NonNullable<TryoutAttempt["endReason"]>;
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];

/** Returns the earliest timestamp that can end an attempt. */
export function getAttemptExpiresAt(attempt: TryoutAttempt) {
  return Math.min(attempt.expiresAt, attempt.accessEndsAt);
}

/** Expires an attempt using its entitlement-bounded timer. */
export const expireAttemptAtEffectiveTime = Effect.fn(
  "tryouts.runtime.expireAttemptAtEffectiveTime"
)(function* (ctx: MutationCtx, args: { attempt: TryoutAttempt; now: number }) {
  const expiresAt = getAttemptExpiresAt(args.attempt);

  if (expiresAt === args.attempt.expiresAt) {
    return yield* expireAttempt(ctx, args);
  }

  yield* tryRuntimePromise(() =>
    ctx.db.patch(args.attempt._id, {
      expiresAt,
      lastActivityAt: args.now,
    })
  );

  const currentAttempt = yield* tryRuntimePromise(() =>
    ctx.db.get(args.attempt._id)
  );

  if (!currentAttempt) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_ATTEMPT_NOT_FOUND",
      message: "Try-out attempt not found.",
    });
  }

  return yield* expireAttempt(ctx, { attempt: currentAttempt, now: args.now });
});

/** Creates an expired section attempt for a section the user never opened. */
const createExpiredSectionAttempt = Effect.fn(
  "tryouts.runtime.createExpiredSectionAttempt"
)(function* (
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    now: number;
    snapshot: TryoutSectionSnapshot;
  }
) {
  const score = yield* scoreTryoutSection(ctx, {
    attempt: args.attempt,
    responses: [],
    sectionKey: args.snapshot.sectionKey,
    totalQuestions: args.snapshot.questionCount,
    ...(args.snapshot.tryoutSectionId
      ? { tryoutSectionId: args.snapshot.tryoutSectionId }
      : {}),
  });

  yield* tryRuntimePromise(() =>
    ctx.db.insert("tryoutSectionAttempts", {
      answeredCount: 0,
      completedAt: args.attempt.expiresAt,
      correctAnswers: 0,
      endReason: "time-expired",
      expiresAt: args.attempt.expiresAt,
      lastActivityAt: args.now,
      ...(args.snapshot.sectionIdentity
        ? { sectionIdentity: args.snapshot.sectionIdentity }
        : {}),
      sectionKey: args.snapshot.sectionKey,
      sectionOrder: args.snapshot.sectionOrder,
      score: getSectionScoreSnapshot(score),
      startedAt: args.attempt.expiresAt,
      status: "expired",
      totalQuestions: args.snapshot.questionCount,
      tryoutAttemptId: args.attempt._id,
      ...(args.snapshot.tryoutSectionId
        ? { tryoutSectionId: args.snapshot.tryoutSectionId }
        : {}),
    })
  );
});

/** Creates expired attempts for unopened sections before final scoring. */
const createMissingExpiredSectionAttempts = Effect.fn(
  "tryouts.runtime.createMissingExpiredSections"
)(function* (
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    now: number;
    sections: TryoutSectionAttempt[];
  }
) {
  const attemptedSectionKeys = new Set(
    args.sections.map((section) => section.sectionKey)
  );

  for (const snapshot of args.attempt.sectionSnapshots) {
    if (attemptedSectionKeys.has(snapshot.sectionKey)) {
      continue;
    }

    yield* createExpiredSectionAttempt(ctx, {
      attempt: args.attempt,
      now: args.now,
      snapshot,
    });
  }
});

/** Finalizes one section attempt and finalizes the parent attempt if complete. */
export const finalizeSectionAttempt = Effect.fn(
  "tryouts.runtime.finalizeSectionAttempt"
)(function* (
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    endReason: TryoutEndReason;
    now: number;
    section: TryoutSectionAttempt;
  }
) {
  const finalization = yield* readSectionFinalization(ctx, {
    attempt: args.attempt,
    section: args.section,
  });
  yield* tryRuntimePromise(() =>
    ctx.db.patch(args.section._id, {
      answeredCount: finalization.answeredCount,
      completedAt: args.now,
      correctAnswers: finalization.correctAnswers,
      endReason: args.endReason,
      lastActivityAt: args.now,
      score: finalization.score,
      status: args.endReason === "time-expired" ? "expired" : "completed",
    })
  );

  const completedSectionKeys = Array.from(
    new Set([...args.attempt.completedSectionKeys, args.section.sectionKey])
  );
  yield* tryRuntimePromise(() =>
    ctx.db.patch(args.attempt._id, {
      completedSectionKeys,
      lastActivityAt: args.now,
    })
  );

  if (completedSectionKeys.length < args.attempt.sectionSnapshots.length) {
    return { kind: "completed" };
  }

  const currentAttempt = yield* tryRuntimePromise(() =>
    ctx.db.get(args.attempt._id)
  );
  if (!currentAttempt) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_ATTEMPT_NOT_FOUND",
      message: "Try-out attempt not found.",
    });
  }

  yield* finalizeAttemptScore(ctx, {
    attempt: currentAttempt,
    endReason: "submitted",
    now: args.now,
  });

  return { kind: "completed" };
});

/** Expires one whole attempt and any in-progress section attempts it owns. */
export const expireAttempt = Effect.fn("tryouts.runtime.expireAttempt")(
  function* (ctx: MutationCtx, args: { attempt: TryoutAttempt; now: number }) {
    const sections = yield* tryRuntimePromise(() =>
      ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionOrder", (q) =>
          q.eq("tryoutAttemptId", args.attempt._id)
        )
        .take(args.attempt.sectionSnapshots.length + 1)
    );

    if (sections.length > args.attempt.sectionSnapshots.length) {
      return yield* new TryoutRuntimeError({
        code: "TRYOUT_SECTION_ATTEMPT_COUNT_EXCEEDED",
        message: "Try-out section attempt count exceeds the attempt snapshot.",
      });
    }

    for (const section of sections) {
      if (section.status !== "in-progress") {
        continue;
      }

      const finalization = yield* readSectionFinalization(ctx, {
        attempt: args.attempt,
        section,
      });

      yield* tryRuntimePromise(() =>
        ctx.db.patch(section._id, {
          answeredCount: finalization.answeredCount,
          completedAt: args.attempt.expiresAt,
          correctAnswers: finalization.correctAnswers,
          endReason: "time-expired",
          lastActivityAt: args.now,
          score: finalization.score,
          status: "expired",
        })
      );
    }

    yield* createMissingExpiredSectionAttempts(ctx, {
      attempt: args.attempt,
      now: args.now,
      sections,
    });

    yield* tryRuntimePromise(() =>
      ctx.db.patch(args.attempt._id, {
        completedSectionKeys: args.attempt.sectionSnapshots.map(
          (section) => section.sectionKey
        ),
        lastActivityAt: args.now,
      })
    );

    const currentAttempt = yield* tryRuntimePromise(() =>
      ctx.db.get(args.attempt._id)
    );
    if (!currentAttempt) {
      return yield* new TryoutRuntimeError({
        code: "TRYOUT_ATTEMPT_NOT_FOUND",
        message: "Try-out attempt not found.",
      });
    }

    return yield* finalizeAttemptScore(ctx, {
      attempt: currentAttempt,
      endReason: "time-expired",
      now: args.now,
    });
  }
);

/** Loads bounded responses for one section attempt before finalizing it. */
const loadSectionResponses = Effect.fn("tryouts.runtime.loadSectionResponses")(
  function* (ctx: MutationCtx, section: TryoutSectionAttempt) {
    const responses = yield* tryRuntimePromise(() =>
      ctx.db
        .query("tryoutResponses")
        .withIndex("by_tryoutSectionAttemptId_and_questionId", (query) =>
          query.eq("tryoutSectionAttemptId", section._id)
        )
        .take(section.totalQuestions + 1)
    );
    if (responses.length > section.totalQuestions) {
      return yield* new TryoutRuntimeError({
        code: "TRYOUT_RESPONSE_COUNT_EXCEEDED",
        message: "Try-out response count exceeds the section question count.",
      });
    }
    return responses;
  }
);

/** Calculates the immutable counters and score stored by one terminal section. */
const readSectionFinalization = Effect.fn(
  "tryouts.runtime.readSectionFinalization"
)(function* (
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    section: TryoutSectionAttempt;
  }
) {
  const responses = yield* loadSectionResponses(ctx, args.section);
  const summary = summarizeResponses(responses);
  const score = yield* scoreTryoutSection(ctx, {
    attempt: args.attempt,
    responses,
    sectionKey: args.section.sectionKey,
    totalQuestions: args.section.totalQuestions,
    ...(args.section.tryoutSectionId
      ? { tryoutSectionId: args.section.tryoutSectionId }
      : {}),
  });

  return {
    ...summary,
    score: getSectionScoreSnapshot(score),
  };
});
