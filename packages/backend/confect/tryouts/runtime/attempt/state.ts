import { readAttemptResume } from "@repo/backend/confect/tryouts/runtime/attempt/sections";
import {
  getSectionScoreResult,
  loadAttemptScoreResult,
} from "@repo/backend/confect/tryouts/score/result";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

interface AttemptStateInput {
  readonly attempt: Doc<"tryoutAttempts">;
  readonly sectionKey?: string;
  readonly sections: readonly Doc<"tryoutSectionAttempts">[];
}

/** Projects the loaded attempt graph into its compact reactive state contract. */
export const loadAttemptState = Effect.fn("tryouts.attempt.loadState")(
  function* (
    ctx: QueryCtx,
    { attempt, sectionKey, sections }: AttemptStateInput
  ) {
    const resume = readAttemptResume(attempt, sections);
    const section = sectionKey
      ? (sections.find((candidate) => candidate.sectionKey === sectionKey) ??
        null)
      : null;
    const score = yield* loadAttemptScoreResult(ctx, attempt);
    return {
      activeSectionKey: resume.activeSectionKey,
      attemptId: attempt._id,
      attemptNumber: attempt.attemptNumber,
      completedSectionKeys: attempt.completedSectionKeys,
      expiresAt: attempt.expiresAt,
      resumeSectionKey: resume.resumeSectionKey,
      resumeSectionPublicPath: resume.resumeSectionPublicPath,
      score,
      section: section
        ? {
            answeredCount: section.answeredCount,
            completedAt: section.completedAt,
            endReason: section.endReason,
            expiresAt: section.expiresAt,
            score: yield* getSectionScoreResult(section),
            sectionKey: section.sectionKey,
            startedAt: section.startedAt,
            status: section.status,
            totalQuestions: section.totalQuestions,
          }
        : null,
      startedAt: attempt.startedAt,
      status: attempt.status,
    };
  }
);
