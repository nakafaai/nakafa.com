import type { TryoutSection } from "@nakafa/aksara-contracts/tryout/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  loadAttemptSectionRoutes,
  loadAttemptSections,
  readAttemptResume,
} from "@repo/backend/convex/tryouts/runtime/attempt/sections";
import {
  getSectionScoreResult,
  loadAttemptScoreResult,
} from "@repo/backend/convex/tryouts/score/result";
import { Effect } from "effect";

interface CurrentAttemptInput {
  readonly attempt: Doc<"tryoutAttempts">;
  readonly sectionKey?: string;
  readonly sections?: readonly Doc<"tryoutSectionAttempts">[];
  readonly signedSections?: readonly TryoutSection[];
}

/** Projects one owned attempt into the shared reactive state contract. */
export const loadCurrentAttempt = Effect.fn("tryouts.attempt.loadCurrent")(
  function* (ctx: QueryCtx, input: CurrentAttemptInput) {
    const attempt = input.attempt;
    const [sections, score, sectionRoutes] = yield* Effect.all(
      [
        input.sections
          ? Effect.succeed(input.sections)
          : loadAttemptSections(ctx, attempt),
        loadAttemptScoreResult(ctx, attempt),
        loadAttemptSectionRoutes(ctx, attempt, input.signedSections),
      ],
      { concurrency: "unbounded" }
    );
    const section = input.sectionKey
      ? (sections.find(
          (candidate) => candidate.sectionKey === input.sectionKey
        ) ?? null)
      : null;
    const resume = readAttemptResume(attempt, sections);
    const sectionScore = section ? yield* getSectionScoreResult(section) : null;

    return {
      activeSectionKey: resume.activeSectionKey,
      attemptId: attempt._id,
      attemptNumber: attempt.attemptNumber,
      completedSectionKeys: attempt.completedSectionKeys,
      expiresAt: attempt.expiresAt,
      lastActivityAt: attempt.lastActivityAt,
      resumeSectionKey: resume.resumeSectionKey,
      resumeSectionPublicPath: resume.resumeSectionPublicPath,
      score,
      section: section
        ? {
            answeredCount: section.answeredCount,
            completedAt: section.completedAt,
            endReason: section.endReason,
            expiresAt: section.expiresAt,
            score: sectionScore,
            sectionKey: section.sectionKey,
            startedAt: section.startedAt,
            status: section.status,
            totalQuestions: section.totalQuestions,
          }
        : null,
      sectionRoutes,
      startedAt: attempt.startedAt,
      status: attempt.status,
      totalQuestions: attempt.totalQuestions,
    };
  }
);
