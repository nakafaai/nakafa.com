import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { Array as Arr, Effect, HashSet, Option } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];

/** Loads every started section within the attempt's signed snapshot bound. */
export const loadAttemptSections = Effect.fn(
  "tryouts.runtime.loadAttemptSections"
)(function* (attempt: TryoutAttempt) {
  const database = yield* DatabaseReader;
  const sections = yield* database
    .table("tryoutSectionAttempts")
    .index("by_tryoutAttemptId_and_sectionOrder", (query) =>
      query.eq("tryoutAttemptId", attempt._id)
    )
    .take(attempt.sectionSnapshots.length + 1)
    .pipe(Effect.orDie);
  if (sections.length > attempt.sectionSnapshots.length) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_SECTION_ATTEMPT_COUNT_EXCEEDED",
      message: "Try-out section attempt count exceeds the attempt snapshot.",
    });
  }
  return sections;
});

/** Derives the active or next resumable section from immutable attempt state. */
export function readAttemptResume(
  attempt: TryoutAttempt,
  sections: readonly Docs["tryoutSectionAttempts"][]
) {
  const inProgressSection = Option.getOrUndefined(
    Arr.findFirst(sections, (section) => section.status === "in-progress")
  );
  const completedSections = HashSet.fromIterable(attempt.completedSectionKeys);
  const nextSection = Option.getOrUndefined(
    Arr.findFirst(
      attempt.sectionSnapshots,
      (snapshot) => !HashSet.has(completedSections, snapshot.sectionKey)
    )
  );
  const resumeSection = inProgressSection
    ? Option.getOrUndefined(
        Arr.findFirst(
          attempt.sectionSnapshots,
          (snapshot) => snapshot.sectionKey === inProgressSection.sectionKey
        )
      )
    : nextSection;
  return {
    activeSectionKey: inProgressSection?.sectionKey ?? null,
    resumeSectionKey: resumeSection?.sectionKey ?? null,
  };
}
