import { describe, expect, it } from "@effect/vitest";
import { ARM, n1 } from "@repo/design-system/components/nina/body";
import {
  type Curve,
  exit,
  flip,
  limb,
  onBody,
  wide,
} from "@repo/design-system/components/nina/limb";
import { Array as Arr, String as Str } from "effect";

/** An arm that hangs from her shoulder and curls out at its tip. */
const HANGING: Curve = [80, 146, 38, 166, 36, 204, 12, 200];
/** A limb that runs straight, so its middle line never bends. */
const STRAIGHT: Curve = [0, 0, 20, 0, 40, 0, 60, 0];
/** An arm so short that all of it stays inside her body. */
const HIDDEN: Curve = [80, 146, 84, 150, 88, 154, 92, 158];

/** How many curved segments an outline draws. */
function curves(outline: string) {
  return Str.split(outline, "Q").length - 1;
}

describe("a limb", () => {
  it("is thickest at its root, wider still where it joins her body, and thinnest at its tip", () => {
    expect(wide(0, ARM)).toBeGreaterThan(wide(0.25, ARM));
    expect(wide(0.25, ARM)).toBeGreaterThan(wide(0.5, ARM));
    expect(wide(0.5, ARM)).toBeGreaterThan(wide(1, ARM));
    expect(wide(1, ARM)).toBe(ARM.thin / 2);
    // Past the join it tapers by the same law, with nothing added.
    expect(wide(0.5, ARM)).toBeCloseTo(
      (ARM.thick + (ARM.thin - ARM.thick) * 0.5 ** 0.85) / 2,
      12
    );
  });

  it("is mirrored about the middle of her body", () => {
    expect(flip(HANGING)).toEqual([124, 146, 166, 166, 168, 204, 192, 200]);
    expect(flip(flip(HANGING))).toEqual(HANGING);
  });

  it("is round at both ends when it is whole, and cut straight when it is a part", () => {
    expect(curves(limb(HANGING, ARM))).toBe(2 * 15 + 2);
    expect(curves(limb(HANGING, ARM, 0.4))).toBe(2 * 15 + 1);
    expect(limb(HANGING, ARM)).toMatch(/^M[\d.,-]+ L[\d.,-]+ Q/u);
    expect(limb(HANGING, ARM)).toMatch(/ Z$/u);
  });

  it("is as wide as its law says along a middle line that does not bend", () => {
    // Its outline starts on the left edge of the root, half a width above the line.
    expect(Str.startsWith(`M0,${n1(wide(0, ARM))} `)(limb(STRAIGHT, ARM))).toBe(
      true
    );
  });

  it("is drawn even when its middle line has not moved", () => {
    expect(limb([5, 5, 5, 5, 5, 5, 5, 5], ARM)).not.toContain("NaN");
  });

  it("knows where her body is", () => {
    expect(onBody(102, 170)).toBe(true);
    expect(onBody(80, 146)).toBe(true);
    expect(onBody(10, 170)).toBe(false);
    expect(onBody(102, 230)).toBe(false);
  });

  it("starts its top part where the whole width of the arm has left her body", () => {
    const from = exit(HANGING, ARM);
    expect(from).toBeGreaterThan(0.12);
    expect(from).toBeLessThan(0.8);
    expect(exit(HIDDEN, ARM)).toBe(0.8);
    expect(exit(STRAIGHT, ARM)).toBe(0.12);
    expect(
      Arr.every([HANGING, STRAIGHT, HIDDEN], (c) => exit(c, ARM) >= 0.12)
    ).toBe(true);
  });
});
