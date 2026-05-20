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

  it("uses arithmetic for substituted function values", () => {
    expect(mathArithmetic).toContain("already-substituted function values");
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
    expect(mathProbability).toContain(
      "call probability before any calculus derivation detail"
    );
    expect(mathProbability).toContain(
      "evidence source for expectations, variances, and moments"
    );
  });

  it("keeps transformed probability moments in expression, not variable", () => {
    expect(mathProbability).toContain("For E[X^4]");
    expect(mathProbability).toContain("variable X");
    expect(mathProbability).toContain("expression X^4");
    expect(mathProbability).toContain(
      "Keep variable as the random variable name"
    );
    expect(mathProbability).toContain("check the requested moment here first");
    expect(mathProbability).toContain(
      "explain the definition, identity, recurrence, or theorem"
    );
    expect(mathProbability).toContain(
      'Do not reduce a requested derivation to only "known", "given", or the final number.'
    );
    expect(mathCalculus).toContain(
      "Do not use for named probability distribution moments"
    );
  });

  it("requires calculus variables for parameterized expressions", () => {
    expect(mathCalculus).toContain(
      "Include variable when the expression has parameters or more than one symbol"
    );
  });

  it("keeps optimization evidence complete enough for extrema", () => {
    expect(mathCalculus).toContain("For optimization or extrema");
    expect(mathCalculus).toContain("differentiate first");
    expect(mathCalculus).toContain("solve the critical equation");
    expect(mathCalculus).toContain("call arithmetic evaluate");
    expect(mathCalculus).toContain("after substituting each valid candidate");
    expect(mathCalculus).toContain("minimum point and maximum point requests");
    expect(mathCalculus).toContain(
      "until the substituted original expression is checked"
    );
  });

  it("keeps calculus operation syntax out of expression inputs", () => {
    expect(mathCalculus).toContain("Send the target mathematical expression");
    expect(mathCalculus).toContain(
      "Do not wrap expression in operation syntax"
    );
    expect(mathCalculus).toContain("set order");
  });

  it("requires calculus bounds for definite or improper integrals", () => {
    expect(mathCalculus).toContain(
      "Definite or improper integrals must include lower and upper"
    );
  });

  it("preserves solve-domain restrictions for equations", () => {
    expect(mathEquation).toContain("Preserve solve-domain bounds");
    expect(mathEquation).toContain("lower, upper, and inclusivity fields");
    expect(mathEquation).toContain("Use solve instead of roots");
    expect(mathEquation).toContain(
      "set variable to the bounded variable and variables to all solved variables"
    );
  });
});
