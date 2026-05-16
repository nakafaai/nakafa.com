import { mathProbability } from "@repo/ai/agents/math/descriptions";
import { describe, expect, it } from "vitest";

describe("math tool descriptions", () => {
  it("routes finite equally likely outcomes away from named distributions", () => {
    expect(mathProbability).toContain(
      "For fair dice, cards, or any finite equally likely outcome list"
    );
  });
});
