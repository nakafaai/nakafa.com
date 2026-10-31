import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { Array as Arr, Effect, HashSet, Option } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];

/** Loads every started section, bounded by the attempt's frozen sections. */
export const loadAttemptSections = Effect.fn(
  "tryouts.runtime.loadAttemptSections"
)(function* (attempt: TryoutAttempt) {
  const database = yield* DatabaseReader;
  const sections = yield* database
    .table("tryoutSectionAttempts")
    .index("by_tryoutAttemptId_and_sectionOrder", (query) =>
      query.eq("tryoutAttemptId", attempt._id)
    )
    .take(attempt.sections.length + 1)
    .pipe(Effect.orDie);
  if (sections.length > attempt.sections.length) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_SECTION_ATTEMPT_COUNT_EXCEEDED",
      message:
        "Try-out section attempt count exceeds the attempt's frozen sections.",
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
      attempt.sections,
      (frozen) => !HashSet.has(completedSections, frozen.sectionKey)
    )
  );
  const resumeSection = inProgressSection
    ? Option.getOrUndefined(
        Arr.findFirst(
          attempt.sections,
          (frozen) => frozen.sectionKey === inProgressSection.sectionKey
        )
      )
    : nextSection;
  return {
    activeSectionKey: inProgressSection?.sectionKey ?? null,
    resumeSectionKey: resumeSection?.sectionKey ?? null,
  };
}
