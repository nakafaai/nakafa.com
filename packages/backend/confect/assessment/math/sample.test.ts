import { describe, expect, it } from "@effect/vitest";
import { parseExpression } from "@repo/backend/confect/assessment/math/parse";
import {
  agree,
  agreesAtPoints,
  SAMPLE_TOLERANCE,
} from "@repo/backend/confect/assessment/math/sample";
import { Option } from "effect";

/** Whether two expressions agree at the points of a seed. */
const agreesOf = (left: string, right: string, seed = `${left}\n${right}`) =>
  agreesAtPoints(
    Option.getOrThrow(parseExpression(left)),
    Option.getOrThrow(parseExpression(right)),
    seed
  );

describe("assessment/math agree", () => {
  it("takes values within the tolerance of the larger, and never closer than it absolutely", () => {
    expect(agree(1e6, 1e6 + 1e-4, SAMPLE_TOLERANCE)).toBe(true);
    expect(agree(1e6, 1e6 + 1e-2, SAMPLE_TOLERANCE)).toBe(false);
    expect(agree(0, 1e-10, SAMPLE_TOLERANCE)).toBe(true);
    expect(agree(0, 1e-8, SAMPLE_TOLERANCE)).toBe(false);
  });
});

describe("assessment/math agreesAtPoints", () => {
  it("agrees on an identity at every point both sides are defined", () => {
    expect(agreesOf("\\sin^2 x+\\cos^2 x", "1")).toBe(true);
    expect(agreesOf("\\ln(xy)", "\\ln x+\\ln y")).toBe(true);
    expect(agreesOf("\\sqrt{x}\\sqrt{x}", "x")).toBe(true);
  });

  it("refuses at the first point where the two differ", () => {
    expect(agreesOf("\\sin x", "x")).toBe(false);
    expect(agreesOf("e^{x}", "e^{x}+10^{-6}\\sin x")).toBe(false);
  });

  it("refuses a pair defined together at fewer than the points it needs", () => {
    expect(agreesOf("\\sqrt{-1-x^2}", "\\sqrt{-1-x^2}")).toBe(false);
    expect(agreesOf("\\ln(x-3.9)", "\\ln(x-3.9)")).toBe(false);
  });

  it("reads the same points for the same seed, so a verdict never changes", () => {
    const seed = "a fixed seed";
    expect(agreesOf("\\cos x", "\\sin(x+\\frac{\\pi}{2})", seed)).toBe(
      agreesOf("\\cos x", "\\sin(x+\\frac{\\pi}{2})", seed)
    );
  });
});
