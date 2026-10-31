import { describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { loadAttemptPlacements } from "@repo/backend/confect/tryouts/runtime/placement";
import { loadAttemptResponses } from "@repo/backend/confect/tryouts/runtime/response";
import {
  finalizeAttemptScore,
  loadAttemptScoreSource,
  scoreTryoutSection,
} from "@repo/backend/confect/tryouts/runtime/score";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { TRYOUT_NOW, tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect } from "effect";

/** Reads an attempt with its complete response index and score source, as finishing reads them. */
const readScoring = (attemptId: Id<"tryoutAttempts">) =>
  Effect.gen(function* () {
    const attempt = yield* (yield* DatabaseReader)
      .table("tryoutAttempts")
      .get(attemptId)
      .pipe(Effect.orDie);
    const placements = yield* loadAttemptPlacements(attempt);
    const responseIndex = yield* loadAttemptResponses(
      attempt,
      placements,
      "partial"
    );
    const source = yield* loadAttemptScoreSource(attempt, placements);
    return { attempt, responseIndex, source };
  });

describe("tryouts/runtime/score", () => {
  it.effect(
    "scores only an active attempt with a source loaded for it, and its owner's attempt only",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { attemptId } = yield* world.start();
        const code = yield* world.run(
          Effect.gen(function* () {
            const { attempt, responseIndex, source } =
              yield* readScoring(attemptId);
            const inactive = yield* finalizeAttemptScore({
              attempt: { ...attempt, status: "completed" },
              endReason: "submitted",
              now: TRYOUT_NOW,
              responseIndex,
              source,
            }).pipe(Effect.flip);
            const mismatched = yield* scoreTryoutSection({
              attempt,
              placements: responseIndex.placements,
              responses: responseIndex.responses,
              source: {
                attemptId: source.attemptId,
                kind: "answer-count",
                scoring: {
                  kind: "penalized",
                  marks: { blank: 0, correct: 4, wrong: -1 },
                },
              },
              totalQuestions: attempt.totalQuestions,
            }).pipe(Effect.flip);
            return [inactive.code, mismatched.code];
          })
        );
        expect(code).toEqual([
          "TRYOUT_ATTEMPT_NOT_ACTIVE",
          "TRYOUT_SCORE_SOURCE_MISMATCH",
        ]);
      })
  );
});
