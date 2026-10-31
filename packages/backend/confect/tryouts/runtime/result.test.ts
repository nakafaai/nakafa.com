import { describe, expect, it } from "@effect/vitest";
import {
  getSectionScoreSnapshot,
  ScoredAnswer,
  scoreAnswers,
} from "@repo/backend/confect/tryouts/runtime/result";
import { Effect, Schema } from "effect";

const scored = Schema.decodeUnknownSync(ScoredAnswer);
const correct = scored({
  answered: true,
  grade: { category: 1, ceiling: 1, status: "scored" },
  placementId: "placement-correct",
});
const pending = scored({
  answered: true,
  grade: { ceiling: 1, status: "pending" },
  placementId: "placement-pending",
});
const marks = { blank: 0, correct: 4, wrong: -1 };
const official = {
  publishedScore: 500,
  rawScore: 50,
  scoreStatus: "official",
  scoringStrategy: "irt",
  totalCorrect: 1,
  totalQuestions: 2,
} as const;

describe("tryouts/runtime/result", () => {
  it.effect(
    "keeps a score provisional while an answer waits for a person, which earns nothing yet",
    () =>
      Effect.gen(function* () {
        expect(
          yield* scoreAnswers([correct, pending], { kind: "raw" }, 2)
        ).toMatchObject({
          publishedScore: 50,
          rawScore: 50,
          scoreStatus: "provisional",
          totalCorrect: 1,
        });
        expect(
          yield* scoreAnswers(
            [correct, pending],
            { kind: "penalized", marks },
            2
          )
        ).toMatchObject({ publishedScore: 4, scoreStatus: "provisional" });
        expect(yield* scoreAnswers([], { kind: "raw" }, 0)).toMatchObject({
          publishedScore: 0,
          rawScore: 0,
          scoreStatus: "official",
        });
      })
  );

  it.effect("stores a section's ability estimate whole or not at all", () =>
    Effect.gen(function* () {
      expect(yield* getSectionScoreSnapshot(official)).toEqual({
        publishedScore: 500,
        rawScore: 50,
        scoreStatus: "official",
        scoringStrategy: "irt",
      });
      expect(
        yield* getSectionScoreSnapshot({ ...official, theta: 0, thetaSE: 1 })
      ).toMatchObject({ theta: 0, thetaSE: 1 });
      for (const partial of [{ theta: 0 }, { thetaSE: 1 }]) {
        expect(
          yield* getSectionScoreSnapshot({ ...official, ...partial }).pipe(
            Effect.flip,
            Effect.map(({ code }) => code)
          )
        ).toBe("TRYOUT_SCORE_ESTIMATE_INCOMPLETE");
      }
    })
  );
});
