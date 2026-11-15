import type { ContentLanguage } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import tryoutsInternal from "@repo/backend/confect/_generated/refs/tryouts.server";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import {
  chooseStartLanguage,
  rememberWorkingLanguage,
  requireSectionLanguage,
} from "@repo/backend/confect/tryouts/language";
import { loadAttemptSections } from "@repo/backend/confect/tryouts/runtime/attempt/sections";
import {
  TryoutRuntimeError,
  toTryoutRuntimeError,
} from "@repo/backend/confect/tryouts/runtime/error";
import { finalizeSectionAttempt } from "@repo/backend/confect/tryouts/runtime/finish";
import { readOwnedAttemptById } from "@repo/backend/confect/tryouts/runtime/lookup";
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

/**
 * Starts one section attempt and its timer inside an attempt the gate admitted
 * (`tryoutGate.startSection`), which checked its owner, state, and deadline. The section shows its
 * questions in the language the learner confirmed on its page, else in their working language for the
 * exam, else in its first (`chooseStartLanguage`). A section that already runs keeps the language saved
 * on it.
 */
export const startSectionAttempt = Effect.fn(
  "tryouts.runtime.startSectionAttempt"
)(function* (args: {
  attempt: TryoutAttempt;
  now: number;
  questionLanguage: ContentLanguage | undefined;
  sectionKey: string;
}) {
  const scheduler = yield* Scheduler;
  const writer = yield* DatabaseWriter;
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
  const questionLanguage = yield* chooseStartLanguage({
    attempt: args.attempt,
    chosen: args.questionLanguage,
    languages: frozen.languages,
    now: args.now,
  });
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
      questionLanguage,
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

/**
 * Switches the language one section of the learner's attempt shows its questions in, while it runs or
 * in its review, and remembers it as their working language for the exam. Answers, flags, and the clock
 * stay as they are, since a grade reads no language. A section the attempt holds no row for yet, or
 * whose questions are not written in the language, refuses the switch.
 */
export const chooseSectionLanguage = Effect.fn(
  "tryouts.runtime.chooseSectionLanguage"
)(function* (args: {
  attemptId: Id<"tryoutAttempts">;
  language: ContentLanguage;
  now: number;
  sectionKey: string;
  userId: Id<"users">;
}) {
  const attempt = yield* readOwnedAttemptById(args.attemptId, args.userId);
  const section = attempt
    ? yield* loadSectionAttempt({
        attemptId: attempt._id,
        sectionKey: args.sectionKey,
      })
    : null;
  if (!(attempt && section)) {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_SECTION_NOT_FOUND",
      message: "Try-out section is not part of this attempt.",
    });
  }
  const frozen = yield* requireSection(attempt, args.sectionKey);
  yield* requireSectionLanguage(frozen.languages, args.language);
  if (section.questionLanguage !== args.language) {
    yield* (yield* DatabaseWriter)
      .table("tryoutSectionAttempts")
      .patch(section._id, { questionLanguage: args.language })
      .pipe(Effect.mapError(toTryoutRuntimeError));
    yield* captureProductEvent({
      distinctId: args.userId,
      event: {
        name: "tryout question language changed",
        properties: {
          country_key: attempt.countryKey,
          exam_key: attempt.examKey,
          from: section.questionLanguage,
          section_key: section.sectionKey,
          to: args.language,
        },
      },
      timestamp: args.now,
    });
  }
  yield* rememberWorkingLanguage({
    exam: attempt,
    language: args.language,
    now: args.now,
    userId: args.userId,
  });
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
