import { assert, describe, expect, it } from "@effect/vitest";
import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import type { TryoutMarks } from "@nakafa/aksara-contracts/tryout/spec";
import { Id } from "@repo/backend/confect/_generated/id";
import type { Outcome } from "@repo/backend/confect/response/model";
import { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import {
  type AttemptScore,
  getSectionScoreSnapshot,
  readScoredAnswers,
  type ScoredAnswer,
  scoreAnswers,
} from "@repo/backend/confect/tryouts/runtime/result";
import { Effect, Schema, Struct } from "effect";

const marks: TryoutMarks = { blank: 0, correct: 4, wrong: -1 };
const placementId = Schema.decodeUnknownSync(Id("tryoutAttemptPlacements"))(
  "placement"
);

/** Builds one scored placement; `answered` defaults to a complete answer. */
function answer(
  outcome: Outcome | null,
  worth = 1,
  answered = outcome !== null
): ScoredAnswer {
  return {
    answered,
    marks,
    outcome,
    placementId,
    worth,
  };
}

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
  it("reads outcome, worth, and section marks for every placement", () => {
    const decodePlacement = Schema.decodeUnknownSync(
      Id("tryoutAttemptPlacements")
    );
    const choice = decodePlacement("choice");
    const rubric = decodePlacement("rubric");
    const blank = decodePlacement("blank");
    const label = { de: "Teil", en: "Part", id: "Bagian" };
    const single = {
      kind: "single-choice",
      options: [
        { isCorrect: true, label: "A", optionKey: "option-1", order: 1 },
      ],
    } as const;

    expect(
      readScoredAnswers(
        [{ marks, sectionIdentity: "penalized" }, { sectionIdentity: "raw" }],
        [
          {
            _id: choice,
            points: 3,
            responseSpec: single,
            sectionIdentity: "penalized",
          },
          {
            _id: rubric,
            responseSpec: {
              criteria: [
                {
                  criterionKey: "criterion-1",
                  label,
                  levels: [
                    { label, levelKey: "level-1", order: 1, points: 0 },
                    { label, levelKey: "level-2", order: 2, points: 4 },
                  ],
                  order: 1,
                },
              ],
              kind: "rubric",
              language: DeliveryLanguageSchema.make("id"),
            },
            sectionIdentity: "raw",
          },
          { _id: blank, responseSpec: single, sectionIdentity: "raw" },
        ],
        [
          { isComplete: true, isCorrect: true, placementId: choice },
          {
            isComplete: false,
            isCorrect: false,
            outcome: { points: 2, status: "partial" },
            placementId: rubric,
          },
        ]
      )
    ).toEqual([
      {
        answered: true,
        marks,
        outcome: { status: "correct" },
        placementId: choice,
        worth: 3,
      },
      {
        answered: false,
        outcome: { points: 2, status: "partial" },
        placementId: rubric,
        worth: 4,
      },
      { answered: false, outcome: null, placementId: blank, worth: 1 },
    ]);
  });

  it.effect("scores raw sets by the worth each answer earned", () =>
    Effect.gen(function* () {
      const answers = [
        answer({ status: "correct" }, 2),
        answer({ points: 2, status: "partial" }, 3),
        answer({ status: "incorrect" }),
        answer(null, 4),
      ];

      assert.deepStrictEqual(yield* scoreAnswers(answers, "raw", 4), {
        publishedScore: 40,
        rawScore: 40,
        scoreStatus: "official",
        scoringStrategy: "raw",
        totalCorrect: 1,
        totalQuestions: 4,
      });
      assert.strictEqual(
        (yield* scoreAnswers(answers, "weighted", 4)).publishedScore,
        40
      );
    })
  );

  it.effect("adds signed section marks times worth for penalized sets", () =>
    Effect.gen(function* () {
      const score = yield* scoreAnswers(
        [
          answer({ status: "correct" }, 3),
          answer({ status: "incorrect" }, 2),
          answer({ points: 1, status: "partial" }, 2),
          answer(null),
          answer({ status: "incorrect" }, 1, false),
          answer({ status: "pending" }, 5),
        ],
        "penalized",
        6
      );

      assert.deepStrictEqual(score, {
        publishedScore: 14,
        rawScore: 29,
        scoreStatus: "provisional",
        scoringStrategy: "penalized",
        totalCorrect: 1,
        totalQuestions: 6,
      });
    })
  );

  it.effect("rejects a penalized section that lost its signed marks", () =>
    Effect.gen(function* () {
      const failure = yield* scoreAnswers(
        [Struct.omit(answer({ status: "correct" }), ["marks"])],
        "penalized",
        1
      ).pipe(Effect.flip);

      assert.ok(failure instanceof TryoutRuntimeError);
      assert.strictEqual(failure.code, "TRYOUT_SCORE_SOURCE_MISMATCH");
    })
  );

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
          ...Struct.omit(completeScore, ["theta", "thetaSE"]),
          scoringStrategy: "raw",
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
      const failure = yield* getSectionScoreSnapshot(
        Struct.omit(completeScore, ["thetaSE"])
      ).pipe(Effect.flip);

      assert.ok(failure instanceof TryoutRuntimeError);
      assert.strictEqual(failure.code, "TRYOUT_SCORE_ESTIMATE_INCOMPLETE");
      assert.strictEqual(
        failure.message,
        "Try-out score estimate is missing theta or standard error."
      );
    })
  );
});
