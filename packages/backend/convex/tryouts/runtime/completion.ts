import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  requireTryoutResponseSectionSnapshot,
  TryoutResponseIntegrityError,
} from "@repo/backend/convex/tryouts/response/integrity";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;

/** Validates current progress before one section becomes terminal. */
export const readSectionCompletion = Effect.fn(
  "tryouts.runtime.readSectionCompletion"
)(function* (attempt: TryoutAttempt, section: TryoutSectionAttempt) {
  yield* requireTryoutResponseSectionSnapshot(attempt, section);

  if (attempt.status !== "in-progress") {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt is not active.",
    });
  }
  if (section.status !== "in-progress") {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_SECTION_NOT_ACTIVE",
      message: "Try-out section is not active.",
    });
  }

  const snapshotKeys = new Set(
    attempt.sectionSnapshots.map((snapshot) => snapshot.sectionKey)
  );
  const completedKeys = new Set<string>();
  for (const sectionKey of attempt.completedSectionKeys) {
    if (!snapshotKeys.has(sectionKey) || completedKeys.has(sectionKey)) {
      return yield* completionIntegrity(
        "Try-out completed sections differ from the frozen section snapshot."
      );
    }
    completedKeys.add(sectionKey);
  }

  if (completedKeys.has(section.sectionKey)) {
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
    completesAttempt:
      completedSectionKeys.length === attempt.sectionSnapshots.length,
  };
});

/** Ensures every earlier final-section row is terminal and accounted for. */
export const requireFinalSectionAttempts = Effect.fn(
  "tryouts.runtime.requireFinalSectionAttempts"
)(function* (
  attempt: TryoutAttempt,
  currentSection: TryoutSectionAttempt,
  sections: readonly TryoutSectionAttempt[]
) {
  if (sections.length !== attempt.sectionSnapshots.length) {
    return yield* completionIntegrity(
      "Try-out section attempts do not match the frozen section count."
    );
  }

  const remainingCompletedKeys = new Set(attempt.completedSectionKeys);
  let foundCurrentSection = false;
  for (const section of sections) {
    yield* requireTryoutResponseSectionSnapshot(attempt, section);

    if (section._id === currentSection._id) {
      foundCurrentSection = true;
      if (section.status !== "in-progress") {
        return yield* completionIntegrity(
          "Try-out final section attempt is not active."
        );
      }
      continue;
    }

    if (
      section.status === "in-progress" ||
      !remainingCompletedKeys.delete(section.sectionKey)
    ) {
      return yield* completionIntegrity(
        "Try-out completed section state differs from its section attempts."
      );
    }
  }

  if (!foundCurrentSection || remainingCompletedKeys.size > 0) {
    return yield* completionIntegrity(
      "Try-out final section attempt differs from completed section state."
    );
  }
});

/** Creates one typed fail-closed section completion error. */
function completionIntegrity(message: string) {
  return new TryoutResponseIntegrityError({
    code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
    message,
  });
}
