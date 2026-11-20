import { describe, expect, it } from "@effect/vitest";
import practiceAnswers from "@repo/backend/confect/_generated/tables/practiceAnswers";
import practiceQuestions from "@repo/backend/confect/_generated/tables/practiceQuestions";
import tryoutAttemptPlacements from "@repo/backend/confect/_generated/tables/tryoutAttemptPlacements";
import tryoutResponses from "@repo/backend/confect/_generated/tables/tryoutResponses";
import {
  encodePlacedInteraction,
  encodePlacedQuestion,
  readPlacedQuestion,
} from "@repo/backend/confect/tryouts/runtime/question";
import { Effect, Schema, Struct } from "effect";

/** A typed number, its key, and its rule, as one interaction of a question freezes. */
const NUMBER = {
  interaction: { acceptsFractions: false, id: "part-a", kind: "numericEntry" },
  key: { interaction: "part-a", kind: "numericEntry", value: "2" },
  rule: { floor: 0, kind: "perPart", pointsPerPart: 2 },
} as const;

/** A typed word, its key, and its rule, as a later interaction of the same question freezes. */
const WORD = {
  interaction: { id: "part-b", kind: "textEntry" },
  key: {
    accepted: {
      acceptedAnswers: ["Haus"],
      collapseWhitespace: true,
      ignoreCase: false,
      kind: "text",
    },
    interaction: "part-b",
    kind: "textEntry",
  },
  rule: { kind: "allOrNothing" },
} as const;

/** The question fields of a placement row and a practice question row, as their tables decode them. */
const questionFields = [
  "interactionJson",
  "keyJson",
  "rule",
  "laterInteractions",
] as const;
const placementFields = tryoutAttemptPlacements.Fields.mapFields(
  Struct.pick(questionFields)
);
const practiceFields = practiceQuestions.Fields.mapFields(
  Struct.pick(questionFields)
);

/** The answer fields of a try-out response and a practice answer, as their tables decode them. */
const answerFields = ["response", "grade"] as const;
const responseFields = tryoutResponses.Fields.mapFields(
  Struct.pick(answerFields)
);
const practiceAnswerFields = practiceAnswers.Fields.mapFields(
  Struct.pick(answerFields)
);

describe("tryouts/runtime/question", () => {
  it.effect(
    "reads a question stored before questions held several interactions, unchanged, as its one interaction",
    () =>
      Effect.gen(function* () {
        // A row written before `laterInteractions` existed holds one interaction in these three fields.
        const stored = {
          ...(yield* encodePlacedInteraction(NUMBER)),
          rule: NUMBER.rule,
        };

        for (const fields of [placementFields, practiceFields]) {
          const decoded = yield* Schema.decodeEffect(fields)(stored);
          expect(decoded).toEqual(stored);
          expect(yield* readPlacedQuestion(decoded)).toEqual({
            interactions: [NUMBER],
          });
        }
      })
  );

  it.effect(
    "stores a question of several interactions in the item's order and reads each back with its own key and rule",
    () =>
      Effect.gen(function* () {
        const stored = yield* encodePlacedQuestion([NUMBER, WORD]);

        expect(stored.laterInteractions).toHaveLength(1);
        expect(yield* Schema.decodeEffect(placementFields)(stored)).toEqual(
          stored
        );
        expect(yield* readPlacedQuestion(stored)).toEqual({
          interactions: [NUMBER, WORD],
        });
        expect(yield* encodePlacedQuestion([NUMBER])).not.toHaveProperty(
          "laterInteractions"
        );
      })
  );

  it("keeps a stored answer to one interaction as it was, beside the answer to a question of several", () => {
    // A row written before questions held several interactions.
    const single = {
      grade: { category: 1, ceiling: 1, status: "scored" },
      response: ["option-1"],
    };
    const parts = {
      grade: {
        ceiling: 3,
        parts: [
          {
            grade: { category: 2, ceiling: 2, status: "scored" },
            interaction: "part-a",
          },
          { grade: { ceiling: 1, status: "pending" }, interaction: "part-b" },
        ],
        status: "pending",
      },
      response: {
        parts: [{ interaction: "part-a", response: { text: "2" } }],
      },
    };

    for (const fields of [responseFields, practiceAnswerFields]) {
      expect(Schema.decodeUnknownSync(fields)(single)).toEqual(single);
      expect(Schema.decodeUnknownSync(fields)(parts)).toEqual(parts);
    }
  });
});
