import type { Docs } from "@repo/backend/confect/_generated/docs";
import tryoutsInternal from "@repo/backend/confect/_generated/refs/tryouts.server";
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
import { requireSection } from "@repo/backend/confect/tryouts/runtime/placement";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Duration, Effect, flow, Schema } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
const EntrySectionSchema = Schema.Struct({
  sectionKey: Schema.String,
});
type EntrySection = typeof EntrySectionSchema.Type;
const startSectionResult = Object.freeze({
  kind: "started",
});

/**
 * Ensures the section a start opens belongs to the set: its internal entry, which the set page runs, or
 * one of its public sections, which the learner started from that section's own page.
 */
export const requireEntrySection = Effect.fn(
  "tryouts.runtime.requireEntrySection"
)(function* (sections: readonly EntrySection[], sectionKey: string) {
  if (!Arr.some(sections, (row) => row.sectionKey === sectionKey)) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_ENTRY_SECTION_NOT_FOUND",
      message: "Try-out entry section is not available for this set.",
    });
  }
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
  yield* requireNoParallelSectionTimer(args);
  const frozen = yield* requireSection(args.attempt, args.sectionKey);
  const expiresAt = Math.min(
    args.now + frozen.timeLimitSeconds * 1000,
    args.attempt.expiresAt
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
      sectionKey: frozen.sectionKey,
      sectionOrder: frozen.sectionOrder,
      startedAt: args.now,
      status: "in-progress",
      totalQuestions: frozen.questionCount,
      tryoutAttemptId: args.attempt._id,
    })
    .pipe(Effect.orDie);
  yield* writer
    .table("tryoutAttempts")
    .patch(args.attempt._id, {
      lastActivityAt: args.now,
    })
    .pipe(Effect.orDie);
  yield* scheduler
    .runAfter(
      Duration.millis(Math.max(0, expiresAt - args.now)),
      tryoutsInternal.mutations.expiry.section,
      {
        expiresAt,
        sectionAttemptId,
      }
    )
    .pipe(Effect.catchDefect(flow(toTryoutRuntimeError, Effect.fail)));
  return startSectionResult;
});

/** Loads one existing section attempt by its stable section key. */
export const loadSectionAttempt = Effect.fn(
  "tryouts.runtime.loadSectionAttempt"
)(function* (args: { attemptId: Id<"tryoutAttempts">; sectionKey: string }) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("tryoutSectionAttempts")
    .get("by_tryoutAttemptId_and_sectionKey", args.attemptId, args.sectionKey)
    .pipe(
      Effect.catchTags({
        DocumentDecodeError: Effect.die,
        GetByIndexFailure: () => Effect.succeed(null),
      })
    );
});

/**
 * Rejects or expires any other in-progress section timer. Expiring one never ends the attempt, as the
 * section about to start is still open.
 */
const requireNoParallelSectionTimer = Effect.fn(
  "tryouts.runtime.requireNoParallelSectionTimer"
)(function* (args: {
  attempt: TryoutAttempt;
  now: number;
  sectionKey: string;
}) {
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
});
