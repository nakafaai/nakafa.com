// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  fitText,
  wrapLines,
} from "@repo/design-system/components/contents/mathematics/counterexample/wrap";

/** A face whose every character is half as wide as its size, spaces included. */
function measure(text: string) {
  return text.length * 0.5;
}

describe("setting the claim in lines", () => {
  it("breaks between words, never inside one", () => {
    expect(wrapLines("All odd numbers here are prime", 4, measure)).toEqual([
      "All odd",
      "numbers",
      "here are",
      "prime",
    ]);
    expect(wrapLines("  Extraordinarily long  ", 4, measure)).toEqual([
      "Extraordinarily",
      "long",
    ]);
    expect(wrapLines("", 4, measure)).toEqual([]);
  });

  it("takes the largest type at which the whole claim fits the box", () => {
    const box = { height: 100, leading: 1.25, width: 400 };
    const short = fitText(
      "Some squares are red",
      box,
      { largest: 40, smallest: 10 },
      measure
    );
    expect(short.size).toBe(40);
    expect(short.lines).toEqual(["Some squares are red"]);
    const long = fitText(
      "If a number here is a multiple of four, then it is a multiple of eight",
      box,
      { largest: 40, smallest: 10 },
      measure
    );
    expect(long.size).toBeLessThan(40);
    expect(long.size).toBeGreaterThan(10);
    expect(long.lines.length * long.size * box.leading).toBeLessThanOrEqual(
      100
    );
  });

  it("falls back to the smallest type when nothing fits", () => {
    const tiny = fitText(
      "Unbreakable",
      { height: 5, leading: 1.2, width: 5 },
      { largest: 40, smallest: 10 },
      measure
    );
    expect(tiny).toEqual({ lines: ["Unbreakable"], size: 10 });
  });
});
