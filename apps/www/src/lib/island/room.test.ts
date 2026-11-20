// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import {
  headingOf,
  modelOf,
  roomOf,
  shapeOf,
  suitsOf,
  touches,
} from "@/lib/island/room";
import {
  cover,
  dwellerAt,
  flood,
  plainOf,
  raise,
  speciesOf,
} from "@/lib/island/test.world";

/** Nothing stands in a walker's way. */
const open = () => false;

describe("island/room", () => {
  it("keeps each creature to its own ground: dry land, a beach's sand, water to float on, or a bank to wade", () => {
    const land = plainOf(1);
    flood(land, 10, 10, 2, "lake");
    flood(land, 20, 20, 0.2, "lake");
    cover(land, -10, -10, "sand");
    expect(suitsOf(land, "dry", 0, 0)).toBe(true);
    expect(suitsOf(land, "dry", 10, 10)).toBe(false);
    expect(suitsOf(land, "afloat", 10, 10)).toBe(true);
    expect(suitsOf(land, "afloat", 20, 20)).toBe(false);
    expect(suitsOf(land, "afloat", 0, 0)).toBe(false);
    expect(suitsOf(land, "bank", 20, 20)).toBe(true);
    expect(suitsOf(land, "bank", 10, 10)).toBe(false);
    expect(suitsOf(land, "bank", 0, 0)).toBe(false);
    expect(suitsOf(land, "sand", -10, -10)).toBe(true);
    expect(suitsOf(land, "sand", 0, 0)).toBe(false);
    expect(suitsOf(land, "sand", 20, 20)).toBe(false);
  });

  it("lets nothing stand on ground too steep to climb", () => {
    const land = plainOf(1);
    raise(land, 5, 5, 16);
    expect(suitsOf(land, "dry", 5.4, 5)).toBe(false);
    expect(suitsOf(land, "sand", 5.4, 5)).toBe(false);
    expect(suitsOf(land, "dry", 9, 5)).toBe(true);
  });

  it("measures the room a body takes from the model it is drawn as, once", () => {
    const cow = speciesOf("cow");
    expect(modelOf("fox")).toEqual({ _tag: "body", kind: "fox" });
    expect(modelOf(cow)).toEqual({ _tag: "species", index: cow });
    expect(shapeOf(cow).reach).toBeGreaterThan(shapeOf(cow).half * 2);
    expect(shapeOf("fox").height).toBeCloseTo(2, 6);
    expect(shapeOf(cow)).toBe(shapeOf(cow));
  });

  it("fits a long body only where its front and its back fit too, clear of what stands there", () => {
    const land = plainOf(1);
    flood(land, 0, 2, 1, "lake");
    const cow = { ground: "dry", kind: speciesOf("cow") } as const;
    const hen = { ground: "dry", kind: "hen" } as const;
    // A cow facing the water has its head over it; turned along the bank it stands clear.
    expect(roomOf(land, cow, { x: 0, yaw: 0, z: 0.4 }, open)).toBe(false);
    expect(roomOf(land, cow, { x: 0, yaw: Math.PI / 2, z: 0.4 }, open)).toBe(
      true
    );
    expect(roomOf(land, hen, { x: 0, yaw: 0, z: 0.4 }, open)).toBe(true);
    // A crab is wider than it is long, so it takes the room of its middle alone.
    const crab = { ground: "dry", kind: speciesOf("crab") } as const;
    expect(roomOf(land, crab, { x: 0, yaw: 0, z: 0.9 }, open)).toBe(true);
    const trunk = (x: number, z: number, half: number) =>
      Math.hypot(x - 8, z - 8) < 0.5 + half;
    expect(roomOf(land, hen, { x: 8.3, yaw: 0, z: 8 }, trunk)).toBe(false);
    expect(roomOf(land, hen, { x: 12, yaw: 0, z: 8 }, trunk)).toBe(true);
  });

  it("knows when two bodies touch, a long one along the way it faces", () => {
    const cow = speciesOf("cow");
    const facing = { ...dwellerAt(cow, 0, 0), tz: 5 };
    expect(headingOf(facing)).toBeCloseTo(0, 6);
    expect(headingOf({ ...facing, tx: 5, tz: 0 })).toBeCloseTo(Math.PI / 2, 6);
    expect(headingOf(dwellerAt("hen", 3, 3))).toBe(0);
    // A hen ahead of the cow's nose touches it; the same step to its side does not.
    expect(touches(facing, dwellerAt("hen", 0, 1.4))).toBe(true);
    expect(touches(facing, dwellerAt("hen", 1.4, 0))).toBe(false);
    expect(touches(dwellerAt("hen", 0, 0), dwellerAt("hen", 0.2, 0))).toBe(
      true
    );
  });
});
