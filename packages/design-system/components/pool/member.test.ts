import { describe, expect, it } from "@effect/vitest";
import type { Cover } from "@repo/design-system/components/pool/cover";
import {
  poolMembers,
  poolStarts,
} from "@repo/design-system/components/pool/member";
import { Animal } from "@repo/mascot/animal";
import { Array as Arr, HashSet } from "effect";

/** The animals of a list of members, by name. */
function animalsOf(members: ReturnType<typeof poolMembers>) {
  return Arr.flatMap(members, (member) =>
    member.kind === "animal" ? [member.mascot.animal] : []
  );
}

/** The keys of a list of members, in order. */
function keysOf(members: ReturnType<typeof poolMembers>) {
  return Arr.map(members, (member) => member.key);
}

describe("the members of the pool", () => {
  it("holds the animals of the cast, and Nina's eight things among them", () => {
    const members = poolMembers(22);
    expect(members).toHaveLength(30);
    expect(HashSet.size(HashSet.fromIterable(keysOf(members)))).toBe(30);
    expect(animalsOf(members)).toHaveLength(22);
  });

  it("never shows an animal twice, even with the whole catalog", () => {
    const animals = animalsOf(poolMembers(Animal.literals.length));
    expect(animals).toHaveLength(Animal.literals.length);
    expect(HashSet.size(HashSet.fromIterable(animals))).toBe(animals.length);
  });

  it("lays the things among the animals after the second member, then every fourth, as the pit does", () => {
    const things = Arr.flatMap(poolMembers(22), (member, index) =>
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

  it("keeps every member of a smaller pool in its place in a bigger one, from 23 animals up", () => {
    for (const animals of [23, 40, Animal.literals.length - 1]) {
      const smaller = keysOf(poolMembers(animals));
      const bigger = keysOf(poolMembers(animals + 1));
      expect(Arr.take(bigger, smaller.length)).toEqual(smaller);
    }
  });

  it("sizes each animal by its place among the animals in six radii, and each thing at one radius", () => {
    const radii = Arr.map(
      Arr.take(poolStarts({ animals: 22, scale: 1 }), 8),
      (start) => start.r
    );
    expect(radii).toEqual([30, 38, 27, 38, 46, 46, 27, 56]);
  });

  it("grows the animals of a pool by its scale, and keeps the things at their radius", () => {
    const radii = Arr.map(
      Arr.take(poolStarts({ animals: 22, scale: 2 }), 8),
      (start) => start.r
    );
    expect(radii).toEqual([60, 76, 27, 76, 92, 92, 27, 112]);
  });

  it("starts the pile in the same place on every visit", () => {
    const cover: Cover = { animals: 40, scale: 1.2 };
    expect(poolStarts(cover)).toEqual(poolStarts(cover));
  });
});
