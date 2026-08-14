import type { TryoutSection } from "@nakafa/aksara-contracts/tryout/catalog";
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

interface AttemptStateInput {
  readonly attempt: Doc<"tryoutAttempts">;
  readonly sectionKey?: string;
  readonly sections?: readonly Doc<"tryoutSectionAttempts">[];
}

interface CurrentAttemptInput extends AttemptStateInput {
  readonly signedSections?: readonly TryoutSection[];
}

/** Loads the mutable attempt graph without immutable catalog fields. */
const loadAttemptProjection = Effect.fn("tryouts.attempt.loadProjection")(
  function* (ctx: QueryCtx, input: AttemptStateInput) {
    const attempt = input.attempt;
    const scoreEffect =
      attempt.status === "in-progress"
        ? Effect.succeed(null)
        : loadAttemptScoreResult(ctx, attempt);
    const [sections, score] = yield* Effect.all(
      [
        input.sections
          ? Effect.succeed(input.sections)
          : loadAttemptSections(ctx, attempt),
        scoreEffect,
      ],
      { concurrency: "unbounded" }
    );
    const section = input.sectionKey
      ? (sections.find(
          (candidate) => candidate.sectionKey === input.sectionKey
        ) ?? null)
      : null;
    const sectionState = section
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
      : null;

    return {
      attempt,
      resume: readAttemptResume(attempt, sections),
      score,
      sectionState,
    };
  }
);

/** Projects one exact attempt into the compact reactive state contract. */
export const loadAttemptState = Effect.fn("tryouts.attempt.loadState")(
  function* (ctx: QueryCtx, input: AttemptStateInput) {
    const projection = yield* loadAttemptProjection(ctx, input);
    return {
      activeSectionKey: projection.resume.activeSectionKey,
      attemptId: projection.attempt._id,
      attemptNumber: projection.attempt.attemptNumber,
      completedSectionKeys: projection.attempt.completedSectionKeys,
      expiresAt: projection.attempt.expiresAt,
      resumeSectionKey: projection.resume.resumeSectionKey,
      resumeSectionPublicPath: projection.resume.resumeSectionPublicPath,
      score: projection.score,
      section: projection.sectionState,
      startedAt: projection.attempt.startedAt,
      status: projection.attempt.status,
    };
  }
);

/** Projects the deployed state shape until the current web switches contracts. */
export const loadCurrentAttempt = Effect.fn("tryouts.attempt.loadCurrent")(
  function* (ctx: QueryCtx, input: CurrentAttemptInput) {
    const { projection, sectionRoutes } = yield* Effect.all(
      {
        projection: loadAttemptProjection(ctx, input),
        sectionRoutes: loadAttemptSectionRoutes(
          ctx,
          input.attempt,
          input.signedSections
        ),
      },
      { concurrency: "unbounded" }
    );

    return {
      activeSectionKey: projection.resume.activeSectionKey,
      attemptId: projection.attempt._id,
      attemptNumber: projection.attempt.attemptNumber,
      completedSectionKeys: projection.attempt.completedSectionKeys,
      expiresAt: projection.attempt.expiresAt,
      lastActivityAt: projection.attempt.lastActivityAt,
      resumeSectionKey: projection.resume.resumeSectionKey,
      resumeSectionPublicPath: projection.resume.resumeSectionPublicPath,
      score: projection.score,
      section: projection.sectionState,
      sectionRoutes,
      startedAt: projection.attempt.startedAt,
      status: projection.attempt.status,
      totalQuestions: projection.attempt.totalQuestions,
    };
  }
);
