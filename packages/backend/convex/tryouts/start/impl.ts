import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getIncludedAttemptAccess } from "@repo/backend/convex/tryouts/access/impl";
import { tryoutAttemptAccessSourceKindFree } from "@repo/backend/convex/tryouts/access/source";
import {
  expireAttemptAtEffectiveTime,
  getAttemptExpiresAt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import {
  requireInternalEntrySection,
  startSectionAttempt,
} from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import { createTryoutAttempt } from "@repo/backend/convex/tryouts/start/attempt";
import { selectAttemptScale } from "@repo/backend/convex/tryouts/start/scale";
import {
  loadTryoutStartSource,
  type TryoutStartSource,
} from "@repo/backend/convex/tryouts/start/source";
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

interface StartTryoutAttemptInput {
  readonly args: StartAttemptArgs;
  readonly now: number;
  readonly userId: Id<"users">;
}

/** Starts or resumes one try-out attempt in the caller's atomic mutation. */
export const startTryoutAttempt = Effect.fn("tryouts.start.startTryoutAttempt")(
  function* (ctx: MutationCtx, input: StartTryoutAttemptInput) {
    const source = yield* loadTryoutStartSource(ctx, input.args);
    const latestAttempt = yield* loadLatestAttempt(ctx, input, source);
    const resumed = yield* resumeActiveAttempt(ctx, input, latestAttempt);

    if (resumed) {
      return { attemptId: resumed._id };
    }

    const entrySectionKey = input.args.entrySectionKey;
    if (entrySectionKey) {
      yield* tryStartPromise(() =>
        Promise.resolve(
          requireInternalEntrySection(
            source.kind === "filesystem"
              ? source.sections
              : source.snapshot.sections.map(({ section }) => section.row),
            entrySectionKey
          )
        )
      );
    }

    const [attemptNumber, scaleVersion, access] = yield* Effect.all(
      [
        getNextAttemptNumber(ctx, input, source),
        selectAttemptScale(ctx, source, input.now),
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
      source,
      userId: input.userId,
    });
  }
);

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

    const entrySectionKey = input.args.entrySectionKey;
    if (entrySectionKey) {
      yield* tryStartPromise(() =>
        startSectionAttempt(ctx, {
          attempt,
          now: input.now,
          sectionKey: entrySectionKey,
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
  function* (
    ctx: MutationCtx,
    input: StartTryoutAttemptInput,
    source: TryoutStartSource
  ) {
    if (source.kind === "signed") {
      const attempts = yield* tryStartPromise(() =>
        ctx.db
          .query("tryoutAttempts")
          .withIndex("by_userId_and_setIdentity_and_startedAt", (query) =>
            query
              .eq("userId", input.userId)
              .eq("setIdentity", source.snapshot.setIdentity)
          )
          .order("desc")
          .take(1)
      );
      return attempts.at(0) ?? null;
    }

    const attempts = yield* tryStartPromise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutSetId_and_startedAt", (query) =>
          query.eq("userId", input.userId).eq("tryoutSetId", source.set._id)
        )
        .order("desc")
        .take(1)
    );

    return attempts.at(0) ?? null;
  }
);

/** Returns the next bounded attempt number for one user and set. */
const getNextAttemptNumber = Effect.fn("tryouts.start.getNextAttemptNumber")(
  function* (
    ctx: MutationCtx,
    input: StartTryoutAttemptInput,
    source: TryoutStartSource
  ) {
    if (source.kind === "signed") {
      const attempts = yield* tryStartPromise(() =>
        ctx.db
          .query("tryoutAttempts")
          .withIndex("by_userId_and_setIdentity_and_startedAt", (query) =>
            query
              .eq("userId", input.userId)
              .eq("setIdentity", source.snapshot.setIdentity)
          )
          .take(MAX_ATTEMPTS_PER_USER_SET)
      );
      return yield* readNextAttemptNumber(attempts);
    }

    const attempts = yield* tryStartPromise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutSetId_and_startedAt", (query) =>
          query.eq("userId", input.userId).eq("tryoutSetId", source.set._id)
        )
        .take(MAX_ATTEMPTS_PER_USER_SET)
    );
    return yield* readNextAttemptNumber(attempts);
  }
);

/** Derives the next bounded attempt number from one owner-specific row set. */
const readNextAttemptNumber = Effect.fn("tryouts.start.readAttemptNumber")(
  function* (attempts: readonly TryoutAttempt[]) {
    if (attempts.length >= MAX_ATTEMPTS_PER_USER_SET) {
      return yield* new TryoutStartError({
        code: tryoutStartErrorCode.attemptLimitReached,
        message: "Try-out attempt limit reached for this set.",
      });
    }

    return attempts.length + 1;
  }
);

/** Lifts one Convex promise into the typed start failure channel. */
function tryStartPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutStartError, try: operation });
}
