import type { Docs } from "@repo/backend/confect/_generated/docs";
import { getIncludedAttemptAccess } from "@repo/backend/confect/tryouts/access/impl";
import { tryoutAttemptAccessSourceKindFree } from "@repo/backend/confect/tryouts/access/source";
import { readAttemptDestination } from "@repo/backend/confect/tryouts/runtime/attempt/destination";
import { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { expireAttempt } from "@repo/backend/confect/tryouts/runtime/finish";
import { readAttemptStart } from "@repo/backend/confect/tryouts/runtime/lookup";
import {
  requireInternalEntrySection,
  startSectionAttempt,
} from "@repo/backend/confect/tryouts/runtime/sectionAttempt";
import { createTryoutAttempt } from "@repo/backend/confect/tryouts/start/attempt";
import { selectAttemptScale } from "@repo/backend/confect/tryouts/start/scale";
import { loadTryoutStartSource } from "@repo/backend/confect/tryouts/start/source";
import type {
  AttemptAccessFields,
  StartAttemptArgs,
  StartAttemptResult,
} from "@repo/backend/confect/tryouts/start/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

const ATTEMPT_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
type TryoutAttempt = Docs["tryoutAttempts"];
interface StartTryoutAttemptInput {
  readonly args: StartAttemptArgs;
  readonly now: number;
  readonly userId: Id<"users">;
}

/** Starts or resumes one try-out attempt in the caller's atomic mutation. */
export const startTryoutAttempt = Effect.fn("tryouts.start.startTryoutAttempt")(
  function* (input: StartTryoutAttemptInput) {
    const { activeAttempt, nextAttemptNumber } = yield* readAttemptStart(
      input.args,
      input.userId
    );
    const resumed = yield* resumeActiveAttempt(input, activeAttempt);
    if (resumed) {
      return yield* resolveStartResult(resumed, input.args);
    }
    const source = yield* loadTryoutStartSource(input.args);
    const entrySectionKey = input.args.entrySectionKey;
    if (entrySectionKey) {
      yield* requireInternalEntrySection(
        source.snapshot.sections.map(({ section }) => section.row),
        entrySectionKey
      );
    }
    const [scaleVersion, access] = yield* Effect.all(
      [selectAttemptScale(source, input.now), requireAttemptAccess(input)],
      {
        concurrency: "unbounded",
      }
    );
    const attempt = yield* createTryoutAttempt({
      access,
      args: input.args,
      attemptNumber: nextAttemptNumber,
      now: input.now,
      scaleVersion,
      source,
      userId: input.userId,
    });
    return yield* resolveStartResult(attempt, input.args);
  }
);

/** Binds post-start navigation to the exact immutable attempt snapshot. */
const resolveStartResult = Effect.fn("tryouts.start.resolveStartResult")(
  function* (attempt: TryoutAttempt, args: StartAttemptArgs) {
    if (!args.destinationSectionKey) {
      const publicPath = yield* readAttemptDestination(attempt, args.locale);
      if (!publicPath) {
        return yield* new TryoutRuntimeError({
          code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
          message: "Try-out set route is missing from the attempt snapshot.",
        });
      }
      return {
        attemptId: attempt._id,
        navigation: {
          publicPath,
        },
      } satisfies StartAttemptResult;
    }
    const destination = attempt.sectionSnapshots.find(
      (section) => section.sectionKey === args.destinationSectionKey
    );
    if (!destination?.publicPath) {
      return yield* new TryoutRuntimeError({
        code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
        message: "Try-out destination is missing from the attempt snapshot.",
      });
    }
    const publicPath = yield* readAttemptDestination(
      attempt,
      args.locale,
      args.destinationSectionKey
    );
    if (!publicPath) {
      return yield* new TryoutRuntimeError({
        code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
        message: "The retained exam has no destination in this language.",
      });
    }
    return {
      attemptId: attempt._id,
      navigation: {
        publicPath,
      },
    } satisfies StartAttemptResult;
  }
);

/** Resumes a live attempt or expires its stale predecessor before a new start. */
const resumeActiveAttempt = Effect.fn("tryouts.start.resumeActiveAttempt")(
  function* (input: StartTryoutAttemptInput, attempt: TryoutAttempt | null) {
    if (attempt?.status !== "in-progress") {
      return null;
    }
    if (input.now >= attempt.expiresAt) {
      yield* expireAttempt({
        attempt,
        now: input.now,
      });
      return null;
    }
    const entrySectionKey = input.args.entrySectionKey;
    if (entrySectionKey) {
      const currentEntrySection = attempt.sectionSnapshots.find(
        (section) => section.sectionKey === entrySectionKey
      );
      const entrySection =
        currentEntrySection ??
        attempt.sectionSnapshots.find(
          (section) =>
            section.publicPath === undefined &&
            !attempt.completedSectionKeys.includes(section.sectionKey)
        );
      if (!entrySection || entrySection.publicPath) {
        return attempt;
      }
      yield* startSectionAttempt({
        attempt,
        now: input.now,
        sectionKey: entrySection.sectionKey,
      });
    }
    return attempt;
  }
);

/** Records scoped access for attribution, with unlimited free starts otherwise. */
const requireAttemptAccess = Effect.fn("tryouts.start.requireAttemptAccess")(
  function* (input: StartTryoutAttemptInput) {
    const scope = {
      countryKey: input.args.countryKey,
      examKey: input.args.examKey,
      now: input.now,
      setKey: input.args.setKey,
      trackKey: input.args.trackKey,
      userId: input.userId,
    };
    const included = yield* getIncludedAttemptAccess(scope);
    if (included) {
      return included;
    }
    return {
      accessEndsAt: input.now + ATTEMPT_DURATION_MS,
      accessSourceKind: tryoutAttemptAccessSourceKindFree,
      countsForCompetition: false,
    } satisfies AttemptAccessFields;
  }
);
