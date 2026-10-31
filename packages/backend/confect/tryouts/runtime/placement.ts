import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import type { TryoutSection } from "@repo/backend/confect/tryouts/runtime/schema";
import type { FrozenPlacement } from "@repo/backend/confect/tryouts/start/freeze";
import { toTryoutStartError } from "@repo/backend/confect/tryouts/start/spec";
import { Array as Arr, Effect, Option } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];

/** Loads the frozen section of one attempt by its key, failing when the attempt holds no such section. */
export const requireSection = Effect.fn("tryouts.runtime.requireSection")(
  function* (attempt: TryoutAttempt, sectionKey: string) {
    const section = Arr.findFirst(
      attempt.sections,
      (candidate) => candidate.sectionKey === sectionKey
    );
    if (Option.isNone(section)) {
      return yield* new TryoutAttemptStateError({
        code: "TRYOUT_SECTION_NOT_FOUND",
        message: "Try-out section is not part of this attempt.",
      });
    }
    return section.value;
  }
);

/**
 * Loads one bounded attempt placement inventory for finalization.
 * @see https://docs.convex.dev/production/state/limits#transactions
 */
export const loadAttemptPlacements = Effect.fn(
  "tryouts.runtime.loadAttemptPlacements"
)(function* (attempt: TryoutAttempt) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("tryoutAttemptPlacements")
    .index("by_tryoutAttemptId_and_questionOrder", (query) =>
      query.eq("tryoutAttemptId", attempt._id)
    )
    .take(attempt.totalQuestions + 1)
    .pipe(Effect.mapError(toTryoutRuntimeError));
});

/** Loads the places of one section of an attempt in question order, bounded by its question count. */
export const loadSectionPlacements = Effect.fn(
  "tryouts.runtime.loadSectionPlacements"
)(function* (attempt: TryoutAttempt, section: TryoutSection) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("tryoutAttemptPlacements")
    .index("by_tryoutAttemptId_and_sectionKey_and_questionOrder", (query) =>
      query
        .eq("tryoutAttemptId", attempt._id)
        .eq("sectionKey", section.sectionKey)
    )
    .take(section.questionCount + 1)
    .pipe(Effect.mapError(toTryoutRuntimeError));
});

/** Inserts the places an attempt froze when it started, each owned by the attempt. */
export const createAttemptPlacements = Effect.fn(
  "tryouts.runtime.createAttemptPlacements"
)(function* (attempt: TryoutAttempt, placements: readonly FrozenPlacement[]) {
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    placements,
    (placement) =>
      writer
        .table("tryoutAttemptPlacements")
        .insert({ ...placement, tryoutAttemptId: attempt._id })
        .pipe(Effect.mapError(toTryoutStartError)),
    { discard: true }
  );
});
