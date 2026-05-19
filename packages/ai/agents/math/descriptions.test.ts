import {
  mathAlgebra,
  mathArithmetic,
  mathCalculus,
  mathDiscrete,
  mathEquation,
  mathGeometry,
  mathMatrix,
  mathProbability,
  mathSeries,
  mathStatistics,
} from "@repo/ai/agents/math/descriptions";
import { mathOperations } from "@repo/math/schema/operations";
import { describe, expect, it } from "vitest";

const mathToolDescriptions = [
  mathAlgebra,
  mathArithmetic,
  mathCalculus,
  mathDiscrete,
  mathEquation,
  mathGeometry,
  mathMatrix,
  mathProbability,
  mathSeries,
  mathStatistics,
].join("\n");

describe("math tool descriptions", () => {
  it("keeps every math operation literal visible in tool descriptions", () => {
    for (const operation of mathOperations) {
      expect(mathToolDescriptions).toContain(operation);
    }
  });

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

  it("preserves solve-domain restrictions for equations", () => {
    expect(mathEquation).toContain("Preserve solve-domain bounds");
    expect(mathEquation).toContain("lower, upper, and inclusivity fields");
  });
});
