// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { heapOf } from "@repo/design-system/components/three/apparatus/heap";
import { Array as Arr } from "effect";

describe("a heap of a broken solid", () => {
  it("has as many pieces as asked for, and none for a count below zero", () => {
    expect(heapOf(14, 0.005)).toHaveLength(14);
    expect(heapOf(-3, 0.005)).toHaveLength(0);
  });

  it("lies on the floor within a few centimetres of its middle", () => {
    const heap = heapOf(40, 0.002);
    expect(Arr.every(heap, (piece) => piece.at[1] === 0.002 * 0.4)).toBe(true);
    expect(
      Arr.every(heap, (piece) => Math.hypot(piece.at[0], piece.at[2]) < 0.032)
    ).toBe(true);
  });

  it("is the same heap every time", () => {
    expect(heapOf(6, 0.009)).toEqual(heapOf(6, 0.009));
  });
});
