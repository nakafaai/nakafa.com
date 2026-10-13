import { describe, expect, it } from "@effect/vitest";
import { ARM } from "@repo/mascot/nina/body";
import {
  type Curve,
  cubic,
  exit,
  flip,
  limb,
  onBody,
  wide,
} from "@repo/mascot/nina/limb";
import { tenth } from "@repo/mascot/round";
import { String as Str } from "effect";

/** An arm that hangs from her shoulder and curls out at its tip. */
const HANGING: Curve = [80, 146, 38, 166, 36, 204, 12, 200];
/** A limb that runs straight, so its middle line never bends. */
const STRAIGHT: Curve = [0, 0, 20, 0, 40, 0, 60, 0];
/** An arm so short that all of it stays inside her body. */
const HIDDEN: Curve = [80, 146, 84, 150, 88, 154, 92, 158];

/** An outline that starts on the left edge of a limb and runs along it. */
const STARTS_ALONG = /^M[\d.,-]+ L[\d.,-]+ Q/u;
/** An outline that is closed. */
const ENDS_CLOSED = / Z$/u;

/** How many curved segments an outline draws. */
function curves(outline: string) {
  return Str.split(outline, "Q").length - 1;
}

/** Whether the middle of a limb is on her body at `t` along its middle line. */
function middleOnBody(c: Curve, t: number) {
  return onBody(
    cubic(c[0], c[2], c[4], c[6], t),
    cubic(c[1], c[3], c[5], c[7], t)
  );
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
    expect(limb(HANGING, ARM)).toMatch(STARTS_ALONG);
    expect(limb(HANGING, ARM)).toMatch(ENDS_CLOSED);
  });

  it("is as wide as its law says along a middle line that does not bend", () => {
    // Its outline starts on the left edge of the root, half a width above the line.
    expect(
      Str.startsWith(`M0,${tenth(wide(0, ARM))} `)(limb(STRAIGHT, ARM))
    ).toBe(true);
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

  it("starts its top part in the open, where the middle of the arm has left her body", () => {
    const from = exit(HANGING, ARM);
    expect(middleOnBody(HANGING, 0.12)).toBe(true);
    expect(middleOnBody(HANGING, from)).toBe(false);
    // Nothing of an arm that stays inside her body is in the open, and an arm
    // that starts in the open needs no search.
    expect(exit(HIDDEN, ARM)).toBe(0.8);
    expect(exit(STRAIGHT, ARM)).toBe(0.12);
  });
});
