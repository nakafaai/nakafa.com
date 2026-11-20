import { describe, expect, it } from "@effect/vitest";
import {
  answersQuestion,
  earnedPoints,
  findPart,
  fitsParts,
  QuestionGrade,
  QuestionResponse,
  sumParts,
} from "@repo/backend/confect/assessment/parts";
import { Option, Schema } from "effect";

/** A task of a typed number and a typed word, as two parts of one question. */
const TASK = [
  { acceptsFractions: false, id: "part-a", kind: "numericEntry" },
  { id: "part-b", kind: "textEntry" },
] as const;

describe("assessment/parts", () => {
  it("reads a stored response to one interaction and the parts of a question of several, each as its own kind", () => {
    const decode = Schema.decodeUnknownSync(QuestionResponse);

    expect(decode(["option-1"])).toEqual(["option-1"]);
    expect(
      decode({ parts: [{ interaction: "part-a", response: { text: "2" } }] })
    ).toEqual({ parts: [{ interaction: "part-a", response: { text: "2" } }] });
    expect(() => decode({ parts: [] })).toThrow();
  });

  it("finds a part's own response, and none for a blank part or a response to one interaction", () => {
    const response = {
      parts: [{ interaction: "part-a", response: { text: "2" } }],
    } as const;

    expect(findPart(response, "part-a")).toEqual(Option.some({ text: "2" }));
    expect(findPart(response, "part-b")).toEqual(Option.none());
    expect(findPart({ text: "2" }, "part-a")).toEqual(Option.none());
  });

  it("counts a question answered once any part holds an answer", () => {
    expect(
      answersQuestion({
        parts: [
          { interaction: "part-a", response: { text: " " } },
          { interaction: "part-b", response: { text: "Haus" } },
        ],
      })
    ).toBe(true);
    expect(
      answersQuestion({
        parts: [{ interaction: "part-a", response: { text: " " } }],
      })
    ).toBe(false);
    expect(answersQuestion({ text: "Haus" })).toBe(true);
  });

  it("fits parts that each answer one of the question's interactions once, by that interaction's kind", () => {
    expect(
      fitsParts(TASK, {
        parts: [
          { interaction: "part-b", response: { text: "Haus" } },
          { interaction: "part-a", response: { text: "2" } },
        ],
      })
    ).toBe(true);
    expect(fitsParts(TASK, { text: "2" })).toBe(false);
    expect(
      fitsParts(TASK, {
        parts: [
          { interaction: "part-a", response: { text: "2" } },
          { interaction: "part-a", response: { text: "3" } },
        ],
      })
    ).toBe(false);
    expect(
      fitsParts(TASK, {
        parts: [{ interaction: "part-c", response: { text: "2" } }],
      })
    ).toBe(false);
    expect(
      fitsParts(TASK, {
        parts: [{ interaction: "part-a", response: ["option-1"] }],
      })
    ).toBe(false);
  });

  it("sums the parts into the question's points, pending while one waits, and counts what the scored parts earned", () => {
    const typed = {
      grade: { category: 2, ceiling: 2, status: "scored" },
      interaction: "part-a",
    } as const;
    const waiting = {
      grade: { ceiling: 3, status: "pending" },
      interaction: "part-b",
    } as const;

    const pending = sumParts([typed, waiting]);
    expect(pending).toEqual({
      ceiling: 5,
      parts: [typed, waiting],
      status: "pending",
    });
    expect(earnedPoints(pending)).toBe(2);
    expect(
      sumParts([
        typed,
        {
          grade: { category: 0, ceiling: 3, status: "scored" },
          interaction: "part-b",
        },
      ])
    ).toMatchObject({ category: 2, ceiling: 5, status: "scored" });
    expect(earnedPoints({ category: 1, ceiling: 1, status: "scored" })).toBe(1);
    expect(earnedPoints({ ceiling: 1, status: "pending" })).toBe(0);
  });

  it("stores a grade of one interaction as it was, beside the sum of a question of several", () => {
    const decode = Schema.decodeUnknownSync(QuestionGrade);

    expect(decode({ category: 1, ceiling: 1, status: "scored" })).toEqual({
      category: 1,
      ceiling: 1,
      status: "scored",
    });
    expect(
      decode({
        ceiling: 2,
        parts: [
          { grade: { ceiling: 2, status: "pending" }, interaction: "part-a" },
        ],
        status: "pending",
      })
    ).toMatchObject({ status: "pending" });
  });
});
