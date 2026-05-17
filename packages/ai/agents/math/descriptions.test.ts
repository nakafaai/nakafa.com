import {
  mathCalculus,
  mathProbability,
} from "@repo/ai/agents/math/descriptions";
import { describe, expect, it } from "vitest";

describe("math tool descriptions", () => {
  it("routes finite equally likely outcomes away from named distributions", () => {
    expect(mathProbability).toContain(
      "For fair dice, cards, or any finite equally likely outcome list"
    );
  });

  it("routes named distribution event probabilities through probability", () => {
    expect(mathProbability).toContain("point_probability");
    expect(mathProbability).toContain("cumulative_probability");
    expect(mathProbability).toContain("tail_probability");
    expect(mathProbability).toContain("interval_probability");
    expect(mathProbability).toContain("needs lower and upper");
    expect(mathProbability).toContain(
      "Prefer probability over arithmetic or calculus"
    );
  });

  it("requires calculus variables for parameterized expressions", () => {
    expect(mathCalculus).toContain(
      "Include variable when the expression has parameters or more than one symbol"
    );
  });

  it("requires calculus bounds for definite or improper integrals", () => {
    expect(mathCalculus).toContain(
      "Definite or improper integrals must include lower and upper"
    );
  });
});
