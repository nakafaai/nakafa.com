// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Thing } from "@repo/backend/confect/island/things";
import { MutableHashMap } from "effect";
import { keyOf } from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";
import { spotOf } from "@/lib/island/land/site";
import { roofShareOf } from "@/lib/island/patter";
import { plainOf } from "@/lib/island/test.plain";

/** Sets a thing down at a place of a plain. */
function setDown(land: Land, kind: Thing, x: number, z: number) {
  const spot = spotOf(x, z);
  const key = keyOf(spot.cx, spot.cz);
  MutableHashMap.set(land.things, key, [
    ...MutableHashMap.get(land.things, key).pipe((held) =>
      held._tag === "Some" ? held.value : []
    ),
    { at: spot.at, kind, turn: 0 },
  ]);
}

describe("island/patter", () => {
  it("hears no roof on open land, nor under a tree or beside a well", () => {
    const land = plainOf(2);
    expect(roofShareOf(land, 4, 4)).toBe(0);
    setDown(land, "mango", 6, 4);
    setDown(land, "well", 2, 4);
    expect(roofShareOf(land, 4, 4)).toBe(0);
  });

  it("hears a cottage more the nearer it stands, and not at all from far off", () => {
    const land = plainOf(2);
    setDown(land, "cottage", -40, -40);
    const beside = roofShareOf(land, -38, -40);
    const away = roofShareOf(land, -30, -40);
    expect(beside).toBeGreaterThan(0.3);
    expect(away).toBeGreaterThan(0);
    expect(away).toBeLessThan(beside);
    expect(roofShareOf(land, -10, -40)).toBe(0);
  });

  it("patters at full strength in a village, and never past it", () => {
    const land = plainOf(2);
    setDown(land, "cottage", 10, 10);
    setDown(land, "library", 20, 10);
    setDown(land, "saung", 14, 18);
    setDown(land, "cottage", 14, 2);
    expect(roofShareOf(land, 14, 10)).toBe(1);
  });
});
