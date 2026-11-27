// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  jacketOf,
  LANTERN,
  LANTERN_POSTS,
} from "@repo/design-system/components/three/apparatus/lantern";
import { Array as Arr } from "effect";

const plain = (value: number, digits: number) => value.toFixed(digits);

describe("a lantern battery", () => {
  it("has its positive terminal first, both on its top", () => {
    expect(LANTERN_POSTS[0][0]).toBeLessThan(LANTERN_POSTS[1][0]);
    expect(LANTERN_POSTS[0][1]).toBeGreaterThan(LANTERN.height);
    expect(LANTERN_POSTS[1][1]).toBe(LANTERN_POSTS[0][1]);
  });

  it("keeps both terminals on its top", () => {
    expect(LANTERN.spread).toBeLessThan(LANTERN.width / 2);
  });

  it("prints its voltage, what it is and its size on its jacket", () => {
    const jacket = jacketOf(6, { ground: "blue", ink: "white" }, plain);
    const texts = Arr.filter(jacket.marks, (mark) => mark.kind === "text");
    expect(Arr.map(texts, (mark) => mark.text)).toEqual([
      "6 V",
      "LANTERN BATTERY",
      "4R25",
    ]);
    expect(jacket.width).toBeLessThan(LANTERN.width);
    expect(jacket.ground).toBe("blue");
  });
});
