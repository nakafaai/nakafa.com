import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getIncludedAttemptAccess } from "@repo/backend/convex/tryouts/access/impl";
import { tryoutAttemptAccessSourceKindFree } from "@repo/backend/convex/tryouts/access/source";
import { getActiveTryoutSet } from "@repo/backend/convex/tryouts/read";
import {
  expireAttemptAtEffectiveTime,
  getAttemptExpiresAt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import {
  type AttemptOwnerIdentity,
  readLatestOwnedAttempt,
  readOwnedAttempts,
} from "@repo/backend/convex/tryouts/runtime/lookup";
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
    const owner = yield* loadAttemptOwner(ctx, input, source);
    const latestAttempt = yield* readLatestOwnedAttempt(ctx, owner);
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
        getNextAttemptNumber(ctx, owner),
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
      yield* expireAttemptAtEffectiveTime(ctx, {
        attempt,
        now: input.now,
      }).pipe(Effect.mapError(toTryoutStartError));
      return null;
    }

    const entrySectionKey = input.args.entrySectionKey;
    if (entrySectionKey) {
      yield* startSectionAttempt(ctx, {
        attempt,
        now: input.now,
        sectionKey: entrySectionKey,
      }).pipe(Effect.mapError(toTryoutStartError));
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

/** Resolves both attempt identities retained during the additive migration. */
const loadAttemptOwner = Effect.fn("tryouts.start.loadAttemptOwner")(function* (
  ctx: MutationCtx,
  input: StartTryoutAttemptInput,
  source: TryoutStartSource
) {
  if (source.kind === "filesystem") {
    return {
      tryoutSetId: source.set._id,
      userId: input.userId,
    } satisfies AttemptOwnerIdentity;
  }

  const legacy = yield* tryStartPromise(() =>
    getActiveTryoutSet(ctx, input.args)
  );
  return {
    setIdentity: source.snapshot.setIdentity,
    tryoutSetId: legacy?._id,
    userId: input.userId,
  } satisfies AttemptOwnerIdentity;
});

/** Returns the next bounded attempt number for one user and set. */
const getNextAttemptNumber = Effect.fn("tryouts.start.getNextAttemptNumber")(
  function* (ctx: MutationCtx, owner: AttemptOwnerIdentity) {
    const attempts = yield* readOwnedAttempts(
      ctx,
      owner,
      MAX_ATTEMPTS_PER_USER_SET
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
