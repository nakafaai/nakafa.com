import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutReadContext = Pick<QueryCtx, "db">;

/** Loads every started section within the attempt's signed snapshot bound. */
export const loadAttemptSections = Effect.fn(
  "tryouts.runtime.loadAttemptSections"
)(function* (ctx: TryoutReadContext, attempt: TryoutAttempt) {
  const sections = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutSectionAttempts")
      .withIndex("by_tryoutAttemptId_and_sectionOrder", (query) =>
        query.eq("tryoutAttemptId", attempt._id)
      )
      .take(attempt.sectionSnapshots.length + 1)
  );

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
  sections: readonly Doc<"tryoutSectionAttempts">[]
) {
  const inProgressSection = sections.find(
    (section) => section.status === "in-progress"
  );
  const completedSections = new Set(attempt.completedSectionKeys);
  const nextSection = attempt.sectionSnapshots.find(
    (snapshot) => !completedSections.has(snapshot.sectionKey)
  );
  const resumeSection = inProgressSection
    ? attempt.sectionSnapshots.find(
        (snapshot) => snapshot.sectionKey === inProgressSection.sectionKey
      )
    : nextSection;

  return {
    activeSectionKey: inProgressSection?.sectionKey ?? null,
    resumeSectionKey: resumeSection?.sectionKey ?? null,
    resumeSectionPublicPath: resumeSection?.publicPath ?? null,
  };
}
