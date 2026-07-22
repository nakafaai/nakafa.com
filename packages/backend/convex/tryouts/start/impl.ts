import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getIncludedAttemptAccess } from "@repo/backend/convex/tryouts/access/impl";
import {
  expireAttemptAtEffectiveTime,
  getAttemptExpiresAt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import { requireIrtScaleVersion } from "@repo/backend/convex/tryouts/runtime/irt";
import {
  requireInternalEntrySection,
  startSectionAttempt,
} from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import { tryoutAttemptAccessSourceKindFree } from "@repo/backend/convex/tryouts/schema";
import { createTryoutAttempt } from "@repo/backend/convex/tryouts/start/attempt";
import type {
  AttemptAccessFields,
  StartAttemptArgs,
} from "@repo/backend/convex/tryouts/start/spec";
import {
  TryoutStartError,
  toTryoutStartError,
  tryoutStartErrorCode,
} from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";

const ATTEMPT_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS_PER_USER_SET = 100;

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSet = Doc<"tryoutSets">;

interface StartTryoutAttemptInput {
  readonly args: StartAttemptArgs;
  readonly now: number;
  readonly set: TryoutSet;
  readonly userId: Id<"users">;
}

/** Starts or resumes one try-out attempt in the caller's atomic mutation. */
export const startTryoutAttempt = Effect.fn("tryouts.start.startTryoutAttempt")(
  function* (ctx: MutationCtx, input: StartTryoutAttemptInput) {
    const loaded = yield* Effect.all(
      {
        latestAttempt: loadLatestAttempt(ctx, input),
        sections: loadSections(ctx, input.set),
      },
      { concurrency: "unbounded" }
    );

    if (input.args.entrySectionKey) {
      yield* tryStartPromise(() =>
        Promise.resolve(
          requireInternalEntrySection(
            loaded.sections,
            input.args.entrySectionKey ?? ""
          )
        )
      );
    }

    const resumed = yield* resumeActiveAttempt(
      ctx,
      input,
      loaded.latestAttempt
    );

    if (resumed) {
      return { attemptId: resumed._id };
    }

    const [attemptNumber, scaleVersion, access] = yield* Effect.all(
      [
        getNextAttemptNumber(ctx, input),
        loadAttemptScaleVersion(ctx, input.set),
        requireAttemptAccess(ctx, input),
      ],
      { concurrency: "unbounded" }
    );
    return yield* createTryoutAttempt(ctx, {
      access,
      args: input.args,
      attemptNumber,
      now: input.now,
      scaleVersion,
      sections: loaded.sections,
      set: input.set,
      userId: input.userId,
    });
  }
);

/** Loads and validates ordered section rows for one immutable snapshot. */
const loadSections = Effect.fn("tryouts.start.loadSections")(function* (
  ctx: MutationCtx,
  set: TryoutSet
) {
  const sections = yield* tryStartPromise(() =>
    ctx.db
      .query("tryoutSections")
      .withIndex("by_tryoutSetId_and_order", (query) =>
        query.eq("tryoutSetId", set._id)
      )
      .take(set.sectionCount + 1)
  );

  if (sections.length !== set.sectionCount) {
    return yield* new TryoutStartError({
      code: tryoutStartErrorCode.sectionCountMismatch,
      message: "Try-out set section count is not synced.",
    });
  }

  const totalQuestions = sections.reduce(
    (total, section) => total + section.questionCount,
    0
  );
  const hasMixedRevision = sections.some(
    (section) => section.sourceRevision !== set.sourceRevision
  );

  if (totalQuestions !== set.totalQuestionCount || hasMixedRevision) {
    return yield* new TryoutStartError({
      code: tryoutStartErrorCode.sectionSnapshotMismatch,
      message: "Try-out set sections are not fully synced.",
    });
  }

  return sections;
});

/** Resumes a live attempt or expires its stale predecessor before a new start. */
const resumeActiveAttempt = Effect.fn("tryouts.start.resumeActiveAttempt")(
  function* (
    ctx: MutationCtx,
    input: StartTryoutAttemptInput,
    attempt: TryoutAttempt | null
  ) {
    if (attempt?.status !== "in-progress") {
      return null;
    }

    if (input.now >= getAttemptExpiresAt(attempt)) {
      yield* tryStartPromise(() =>
        expireAttemptAtEffectiveTime(ctx, { attempt, now: input.now })
      );
      return null;
    }

    if (input.args.entrySectionKey) {
      yield* tryStartPromise(() =>
        startSectionAttempt(ctx, {
          attempt,
          now: input.now,
          sectionKey: input.args.entrySectionKey ?? "",
        })
      );
    }

    return attempt;
  }
);

/** Resolves premium access first, then atomically claims the lifetime free try-out. */
const requireAttemptAccess = Effect.fn("tryouts.start.requireAttemptAccess")(
  function* (ctx: MutationCtx, input: StartTryoutAttemptInput) {
    const scope = {
      countryKey: input.args.countryKey,
      examKey: input.args.examKey,
      now: input.now,
      setKey: input.args.setKey,
      trackKey: input.args.trackKey,
      userId: input.userId,
    };
    const included = yield* getIncludedAttemptAccess(ctx, scope);

    if (included) {
      return included;
    }

    const claim = yield* tryStartPromise(() =>
      ctx.db
        .query("tryoutFreeAttemptClaims")
        .withIndex("by_userId", (query) => query.eq("userId", input.userId))
        .unique()
    );

    if (claim) {
      return yield* new TryoutStartError({
        code: tryoutStartErrorCode.accessRequired,
        message: "Nakafa Pro is required for another try-out attempt.",
      });
    }

    yield* tryStartPromise(() =>
      ctx.db.insert("tryoutFreeAttemptClaims", {
        claimedAt: input.now,
        countryKey: input.args.countryKey,
        examKey: input.args.examKey,
        setKey: input.args.setKey,
        trackKey: input.args.trackKey,
        userId: input.userId,
      })
    );

    return {
      accessEndsAt: input.now + ATTEMPT_DURATION_MS,
      accessSourceKind: tryoutAttemptAccessSourceKindFree,
      countsForCompetition: false,
    } satisfies AttemptAccessFields;
  }
);

/** Returns the latest bounded attempt for one user and set. */
const loadLatestAttempt = Effect.fn("tryouts.start.loadLatestAttempt")(
  function* (ctx: MutationCtx, input: StartTryoutAttemptInput) {
    const attempts = yield* tryStartPromise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutSetId_and_startedAt", (query) =>
          query.eq("userId", input.userId).eq("tryoutSetId", input.set._id)
        )
        .order("desc")
        .take(1)
    );

    return attempts.at(0) ?? null;
  }
);

/** Returns the next bounded attempt number for one user and set. */
const getNextAttemptNumber = Effect.fn("tryouts.start.getNextAttemptNumber")(
  function* (ctx: MutationCtx, input: StartTryoutAttemptInput) {
    const attempts = yield* tryStartPromise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutSetId_and_startedAt", (query) =>
          query.eq("userId", input.userId).eq("tryoutSetId", input.set._id)
        )
        .take(MAX_ATTEMPTS_PER_USER_SET)
    );

    if (attempts.length >= MAX_ATTEMPTS_PER_USER_SET) {
      return yield* new TryoutStartError({
        code: tryoutStartErrorCode.attemptLimitReached,
        message: "Try-out attempt limit reached for this set.",
      });
    }

    return attempts.length + 1;
  }
);

/** Loads the immutable score scale required by an IRT attempt. */
const loadAttemptScaleVersion = Effect.fn(
  "tryouts.start.loadAttemptScaleVersion"
)(function* (ctx: MutationCtx, set: TryoutSet) {
  if (set.scoringStrategy !== "irt") {
    return null;
  }

  return yield* tryStartPromise(() =>
    requireIrtScaleVersion(ctx, { tryoutSetId: set._id })
  );
});

/** Lifts one Convex promise into the typed start failure channel. */
function tryStartPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutStartError, try: operation });
}
