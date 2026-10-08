import { TryoutVisibilitySchema } from "@nakafa/aksara-contracts/tryout/spec";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import { loadAttemptSections } from "@repo/backend/confect/tryouts/runtime/attempt/sections";
import {
  TryoutRuntimeError,
  toTryoutRuntimeError,
} from "@repo/backend/confect/tryouts/runtime/error";
import { finalizeSectionAttempt } from "@repo/backend/confect/tryouts/runtime/finish";
import { requireSectionSnapshot } from "@repo/backend/confect/tryouts/runtime/placement";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Duration, Effect, flow, Option, Schema } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
const InternalEntrySectionSchema = Schema.Struct({
  sectionKey: Schema.String,
  visibility: TryoutVisibilitySchema,
});
type InternalEntrySection = typeof InternalEntrySectionSchema.Type;
const startSectionResult = Object.freeze({
  kind: "started",
});

/** Ensures atomic section start is only used for a set-owned internal entry. */
export const requireInternalEntrySection = Effect.fn(
  "tryouts.runtime.requireInternalEntrySection"
)(function* (sections: readonly InternalEntrySection[], sectionKey: string) {
  const section = Option.getOrUndefined(
    Arr.findFirst(sections, (row) => row.sectionKey === sectionKey)
  );
  if (section?.visibility !== "internal-entry") {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_ENTRY_SECTION_NOT_FOUND",
      message: "Try-out entry section is not available for this set.",
    });
  }
});

/** Resolves the timer row that authorizes answers for one placement. */
export const loadPlacementSectionAttempt = Effect.fn(
  "tryouts.runtime.loadPlacementSectionAttempt"
)(function* (placement: Docs["tryoutAttemptPlacements"]) {
  return yield* loadSectionAttempt({
    attemptId: placement.tryoutAttemptId,
    sectionKey: placement.sectionKey,
  });
});

/** Loads one active section attempt by its stable attempt-owned key. */
export const requireActiveSectionAttempt = Effect.fn(
  "tryouts.runtime.requireActiveSectionAttempt"
)(function* (args: { attempt: TryoutAttempt; sectionKey: string }) {
  const section = yield* loadSectionAttempt({
    attemptId: args.attempt._id,
    sectionKey: args.sectionKey,
  });
  if (section?.status !== "in-progress") {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_SECTION_NOT_ACTIVE",
      message: "Try-out section is not active.",
    });
  }
  return section;
});

/** Starts one section attempt and its timer inside an active try-out attempt. */
export const startSectionAttempt = Effect.fn(
  "tryouts.runtime.startSectionAttempt"
)(function* (args: {
  attempt: TryoutAttempt;
  now: number;
  sectionKey: string;
}) {
  const scheduler = yield* Scheduler;
  const writer = yield* DatabaseWriter;
  if (args.attempt.status !== "in-progress") {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt is not active.",
    });
  }
  if (args.now >= args.attempt.expiresAt) {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt time has expired.",
    });
  }
  const existing = yield* loadSectionAttempt({
    attemptId: args.attempt._id,
    sectionKey: args.sectionKey,
  });
  if (existing?.status === "in-progress" && args.now < existing.expiresAt) {
    return startSectionResult;
  }
  if (existing?.status === "in-progress") {
    return yield* new TryoutAttemptStateError({
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
  const currentAttempt = yield* requireNoParallelSectionTimer(args);
  const snapshot = yield* requireSectionSnapshot(
    currentAttempt,
    args.sectionKey
  );
  const expiresAt = Math.min(
    args.now + snapshot.timeLimitSeconds * 1000,
    currentAttempt.expiresAt
  );
  const sectionAttemptId = yield* writer
    .table("tryoutSectionAttempts")
    .insert({
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
    .pipe(
      Effect.mapError(toTryoutRuntimeError),
      Effect.catchDefect((cause) => Effect.fail(toTryoutRuntimeError(cause)))
    );
  yield* writer
    .table("tryoutAttempts")
    .patch(currentAttempt._id, {
      lastActivityAt: args.now,
    })
    .pipe(
      Effect.mapError(toTryoutRuntimeError),
      Effect.catchDefect((cause) => Effect.fail(toTryoutRuntimeError(cause)))
    );
  yield* scheduler
    .runAfter(
      Duration.millis(Math.max(0, expiresAt - args.now)),
      refs.internal.tryouts.mutations.expiry.section,
      {
        expiresAt,
        sectionAttemptId,
      }
    )
    .pipe(Effect.catchDefect(flow(toTryoutRuntimeError, Effect.fail)));
  return startSectionResult;
});

/** Loads one existing section attempt by its stable section key. */
const loadSectionAttempt = Effect.fn("tryouts.runtime.loadSectionAttempt")(
  function* (args: { attemptId: Id<"tryoutAttempts">; sectionKey: string }) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("tryoutSectionAttempts")
      .get("by_tryoutAttemptId_and_sectionKey", args.attemptId, args.sectionKey)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.mapError(toTryoutRuntimeError),
        Effect.catchDefect((cause) => Effect.fail(toTryoutRuntimeError(cause)))
      );
  }
);

/** Rejects or expires any other in-progress section timer. */
const requireNoParallelSectionTimer = Effect.fn(
  "tryouts.runtime.requireNoParallelSectionTimer"
)(function* (args: {
  attempt: TryoutAttempt;
  now: number;
  sectionKey: string;
}) {
  const database = yield* DatabaseReader;
  const sections = yield* loadAttemptSections(args.attempt);
  for (const section of sections) {
    if (section.status !== "in-progress") {
      continue;
    }
    if (args.now >= section.expiresAt) {
      yield* finalizeSectionAttempt({
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
  const currentAttempt = yield* database
    .table("tryoutAttempts")
    .get(args.attempt._id)
    .pipe(
      Effect.mapError(toTryoutRuntimeError),
      Effect.catchDefect((cause) => Effect.fail(toTryoutRuntimeError(cause)))
    );
  if (currentAttempt.status !== "in-progress") {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt is not active.",
    });
  }
  return currentAttempt;
});
