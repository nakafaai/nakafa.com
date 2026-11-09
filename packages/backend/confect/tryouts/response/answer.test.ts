import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import { gradeAnswer } from "@repo/backend/confect/tryouts/response/answer";
import type { PlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import { Result } from "effect";

/** A short answer, as an SNBT isian singkat sets it, which accepts two spellings. */
const SHORT: PlacedQuestion = {
  interaction: { id: "short", kind: "textEntry", label: "Answer" },
  key: {
    accepted: {
      acceptedAnswers: ["Jakarta", "DKI Jakarta"],
      collapseWhitespace: true,
      ignoreCase: true,
      kind: "text",
    },
    interaction: "short",
    kind: "textEntry",
  },
  rule: { kind: "allOrNothing" },
};

const numeric: Interaction = {
  acceptsFractions: false,
  id: "numeric",
  kind: "numericEntry",
  label: "Length",
  unit: "cm",
};

const numericKey: InteractionKey = {
  interaction: "numeric",
  kind: "numericEntry",
  value: "12.5",
};

/** A numeric answer in centimetres, as Penalaran Matematika sets it. */
const NUMERIC: PlacedQuestion = {
  interaction: numeric,
  key: numericKey,
  rule: { kind: "allOrNothing" },
};

/** The grade of a response, or the failure's code when the question refuses it. */
const gradeOf = (question: PlacedQuestion, response: ExamResponse) =>
  Result.match(gradeAnswer(question, response), {
    onFailure: ({ code }) => code,
    onSuccess: ({ grade }) => grade,
  });

describe("tryouts/response/answer", () => {
  it("scores a short answer an accepted answer matches, and one that none matches as nothing, since no person grades a try-out", () => {
    expect(gradeOf(SHORT, { text: " dki  jakarta " })).toEqual({
      category: 1,
      ceiling: 1,
      status: "scored",
    });
    expect(gradeOf(SHORT, { text: "Bandung" })).toEqual({
      category: 0,
      ceiling: 1,
      status: "scored",
    });
  });

  it("scores a numeric answer by its number with either decimal point, and refuses a response that does not fit", () => {
    expect(gradeOf(NUMERIC, { text: "12,5" })).toEqual({
      category: 1,
      ceiling: 1,
      status: "scored",
    });
    expect(gradeOf(NUMERIC, { text: "13" })).toEqual({
      category: 0,
      ceiling: 1,
      status: "scored",
    });
    expect(gradeOf(NUMERIC, ["option-1"])).toBe("TRYOUT_RESPONSE_UNFIT");
  });
});
