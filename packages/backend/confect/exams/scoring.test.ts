import { describe, expect, it } from "@effect/vitest";
import {
  ALL_OR_NOTHING,
  scoringRule,
  takesScoring,
  templatePoints,
} from "@repo/backend/confect/exams/scoring";
import { Array as Arr } from "effect";

describe("exams/scoring", () => {
  it("gives each kind its rule, all or nothing as the stored one", () => {
    expect(scoringRule("allOrNothing")).toBe(ALL_OR_NOTHING);
    expect(scoringRule("perPart")).toMatchObject({ kind: "perPart" });
    expect(scoringRule("wrongParts")).not.toBe(ALL_OR_NOTHING);
  });

  it("scores part by part only the templates whose answer has parts", () => {
    const templates = [
      "choice",
      "choices",
      "truefalse",
      "cause",
      "short",
      "numeric",
      "essay",
      "match",
      "table",
      "reason",
    ] as const;
    expect(Arr.filter(templates, takesScoring)).toEqual([
      "choices",
      "match",
      "table",
    ]);
  });

  it("holds an answer and its reason to at least two points, and any other template to its own", () => {
    expect(templatePoints(1, "reason")).toBe(2);
    expect(templatePoints(5, "reason")).toBe(5);
    expect(templatePoints(1, "choice")).toBe(1);
  });
});
