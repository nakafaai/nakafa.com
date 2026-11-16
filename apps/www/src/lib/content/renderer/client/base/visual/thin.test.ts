import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { thinLine } from "@/lib/content/renderer/client/base/visual/thin";

describe("a thinned line", () => {
  it("keeps the two ends of a straight run however many points sample it", () => {
    const straight = Arr.map(Arr.range(0, 100), (x) => [x, x / 2] as const);
    expect(thinLine(straight, 0.01)).toStrictEqual([
      [0, 0],
      [100, 50],
    ]);
  });

  it("keeps a corner that stands farther than the tolerance, and drops one nearer", () => {
    const corner = [
      [0, 0],
      [1, 0.51],
      [2, 1],
      [3, 0],
    ] as const;
    expect(thinLine(corner, 0.1)).toStrictEqual([
      [0, 0],
      [2, 1],
      [3, 0],
    ]);
  });

  it("measures a closed line from its first point, where its ends meet", () => {
    const loop = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ] as const;
    expect(thinLine(loop, 0.1)).toStrictEqual(loop);
  });

  it("leaves a line of two points as it is", () => {
    const pair = [
      [0, 0],
      [1, 1],
    ] as const;
    expect(thinLine(pair, 0.1)).toBe(pair);
  });
});
