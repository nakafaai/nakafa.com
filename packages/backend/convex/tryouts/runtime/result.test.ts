import { assert, describe, it } from "@effect/vitest";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import {
  type AttemptScore,
  getSectionScoreSnapshot,
} from "@repo/backend/convex/tryouts/runtime/result";
import { Effect } from "effect";

const completeScore: AttemptScore = {
  publishedScore: 72,
  rawScore: 70,
  scoreStatus: "provisional",
  scoringStrategy: "irt",
  theta: 0.55,
  thetaSE: 0.18,
  totalCorrect: 7,
  totalQuestions: 10,
};

describe("tryouts/runtime/result", () => {
  it.effect("projects complete and estimate-free section scores", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* getSectionScoreSnapshot(completeScore), {
        publishedScore: 72,
        rawScore: 70,
        scoreStatus: "provisional",
        scoringStrategy: "irt",
        theta: 0.55,
        thetaSE: 0.18,
      });
      assert.deepStrictEqual(
        yield* getSectionScoreSnapshot({
          ...completeScore,
          scoringStrategy: "raw",
          theta: undefined,
          thetaSE: undefined,
        }),
        {
          publishedScore: 72,
          rawScore: 70,
          scoreStatus: "provisional",
          scoringStrategy: "raw",
        }
      );
    })
  );

  it.effect("rejects a partial score estimate in the typed error channel", () =>
    Effect.gen(function* () {
      const failure = yield* getSectionScoreSnapshot({
        ...completeScore,
        thetaSE: undefined,
      }).pipe(Effect.flip);

      assert.ok(failure instanceof TryoutRuntimeError);
      assert.strictEqual(failure.code, "TRYOUT_SCORE_ESTIMATE_INCOMPLETE");
      assert.strictEqual(
        failure.message,
        "Try-out score estimate is missing theta or standard error."
      );
    })
  );
});
