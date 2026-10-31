import type { Docs } from "@repo/backend/confect/_generated/docs";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import { requireTryoutResponseSection } from "@repo/backend/confect/tryouts/response/integrity";
import { TryoutResponseIntegrityError } from "@repo/backend/confect/tryouts/response/spec";
import { Array as Arr, Effect, HashSet, MutableHashSet } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
type TryoutSectionAttempt = Docs["tryoutSectionAttempts"];

/** Validates current progress before one section becomes terminal. */
export const readSectionCompletion = Effect.fn(
  "tryouts.runtime.readSectionCompletion"
)(function* (attempt: TryoutAttempt, section: TryoutSectionAttempt) {
  const frozen = yield* requireTryoutResponseSection(attempt, section);
  if (section.status !== "in-progress") {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_SECTION_NOT_ACTIVE",
      message: "Try-out section is not active.",
    });
  }
  const frozenKeys = HashSet.fromIterable(
    Arr.map(attempt.sections, (section) => section.sectionKey)
  );
  const completedKeys = MutableHashSet.empty<string>();
  for (const sectionKey of attempt.completedSectionKeys) {
    if (
      !HashSet.has(frozenKeys, sectionKey) ||
      MutableHashSet.has(completedKeys, sectionKey)
    ) {
      return yield* completionIntegrity(
        "Try-out completed sections differ from the frozen sections."
      );
    }
    MutableHashSet.add(completedKeys, sectionKey);
  }
  if (MutableHashSet.has(completedKeys, section.sectionKey)) {
    return yield* completionIntegrity(
      "Try-out section is already recorded as completed."
    );
  }
  const completedSectionKeys = [
    ...attempt.completedSectionKeys,
    section.sectionKey,
  ];
  return {
    completedSectionKeys,
    frozen,
    completesAttempt: completedSectionKeys.length === attempt.sections.length,
  };
});

/** Checks terminal progress after the complete frozen section graph is validated. */
export const requireFinalSectionAttempts = Effect.fn(
  "tryouts.runtime.requireFinalSectionAttempts"
)(function* (
  currentSection: TryoutSectionAttempt,
  sections: readonly TryoutSectionAttempt[]
) {
  for (const section of sections) {
    if (section._id === currentSection._id) {
      continue;
    }
    if (section.status === "in-progress") {
      return yield* completionIntegrity(
        "Try-out completed section state differs from its section attempts."
      );
    }
  }
});

/** Creates one typed fail-closed section completion error. */
function completionIntegrity(message: string) {
  return new TryoutResponseIntegrityError({
    code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
    message,
  });
}
