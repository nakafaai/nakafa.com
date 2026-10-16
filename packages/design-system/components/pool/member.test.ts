import { describe, expect, it } from "@effect/vitest";
import {
  POOL_MEMBERS,
  poolWorld,
} from "@repo/design-system/components/pool/member";
import { Array as Arr, HashSet } from "effect";

describe("the members of the pool", () => {
  it("holds thirty different members, twenty-two animals and eight of Nina's things", () => {
    expect(POOL_MEMBERS).toHaveLength(30);
    const keys = Arr.map(POOL_MEMBERS, (member) => member.key);
    expect(HashSet.size(HashSet.fromIterable(keys))).toBe(30);
    const animals = Arr.flatMap(POOL_MEMBERS, (member) =>
      member.kind === "animal" ? [member.mascot.animal] : []
    );
    expect(animals).toHaveLength(22);
  });

  it("never shows an animal twice", () => {
    const animals = Arr.flatMap(POOL_MEMBERS, (member) =>
      member.kind === "animal" ? [member.mascot.animal] : []
    );
    expect(HashSet.size(HashSet.fromIterable(animals))).toBe(animals.length);
  });

  it("lays the things among the animals after the second member, then every fourth, as the pit does", () => {
    const things = Arr.flatMap(POOL_MEMBERS, (member, index) =>
      member.kind === "thing" ? [{ index, name: member.name }] : []
    );
    expect(things).toEqual([
      { index: 2, name: "book" },
      { index: 6, name: "balls" },
      { index: 10, name: "coffee" },
      { index: 14, name: "bulb" },
      { index: 18, name: "backpack" },
      { index: 22, name: "pencil" },
      { index: 26, name: "trophy" },
      { index: 29, name: "globe" },
    ]);
  });

  it("sizes an animal by its place among six radii, and a thing at one radius", () => {
    const radii = Arr.map(
      Arr.take(poolWorld(1200, 640).balls, 8),
      (ball) => ball.r
    );
    expect(radii).toEqual([30, 38, 27, 46, 46, 56, 27, 38]);
  });

  it("draws every member a fraction smaller in a box narrower than 420 pixels", () => {
    const narrow = poolWorld(390, 800).balls;
    expect(narrow[0].r).toBeCloseTo(30 * 0.72, 10);
    expect(narrow[2].r).toBeCloseTo(27 * 0.72, 10);
  });

  it("starts the pile in the same place on every visit, with each member above the box", () => {
    const first = poolWorld(1200, 640);
    expect(poolWorld(1200, 640)).toEqual(first);
    expect(Arr.every(first.balls, (ball) => !ball.inside && ball.y < 0)).toBe(
      true
    );
    expect(
      Arr.every(
        first.balls,
        (ball) => ball.x >= ball.r && ball.x <= 1200 - ball.r
      )
    ).toBe(true);
  });
});
