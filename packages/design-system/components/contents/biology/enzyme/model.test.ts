// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  cyclePhase,
  reactionFor,
} from "@repo/design-system/components/contents/biology/enzyme/model";

describe("active site lab model", () => {
  it("enforces substrate specificity and produces exact monosaccharides", () => {
    expect(reactionFor("lactase", "lactose")).toEqual({
      fits: true,
      products: ["glucose", "galactose"],
    });
    expect(reactionFor("lactase", "sucrose")).toEqual({
      fits: false,
      products: [],
    });
    expect(reactionFor("sucrase", "sucrose")).toEqual({
      fits: true,
      products: ["glucose", "fructose"],
    });
    expect(reactionFor("sucrase", "maltose")).toEqual({
      fits: false,
      products: [],
    });
    expect(reactionFor("maltase", "maltose")).toEqual({
      fits: true,
      products: ["glucose", "glucose"],
    });
    expect(reactionFor("maltase", "lactose")).toEqual({
      fits: false,
      products: [],
    });
  });

  it("maps catalytic cycle progress across approach, complex, release, and reset", () => {
    expect(cyclePhase(0.1).stage).toBe("approach");
    expect(cyclePhase(0.45)).toMatchObject({ bound: true, stage: "complex" });
    expect(cyclePhase(0.7)).toMatchObject({
      splitting: true,
      stage: "release",
    });
    expect(cyclePhase(0.92).stage).toBe("reset");
    expect(cyclePhase(-0.1).stage).toBe("reset");
  });
});
