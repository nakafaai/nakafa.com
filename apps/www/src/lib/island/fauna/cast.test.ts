// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option, Record as Rec } from "effect";
import { CAST, castOf, packSize } from "@/lib/island/fauna/cast";
import { SPECIES } from "@/lib/island/fauna/species";
import { speciesOf } from "@/lib/island/test.world";

/** The keys of a role's species. */
const keysOf = (role: keyof typeof CAST) =>
  Arr.map(CAST[role], (index) => SPECIES[index].key);

const DICE = { day: 20_000, gx: 3, gz: -2, seed: 4242 };

describe("island/fauna/cast", () => {
  it("gives every role of every habitat species of the catalogue that belong there", () => {
    for (const role of Rec.keys(CAST)) {
      expect(CAST[role].length).toBeGreaterThan(0);
    }
    expect(keysOf("herds")).toContain("deer");
    expect(keysOf("herds")).toContain("elephant");
    expect(keysOf("herds")).not.toContain("goat");
    expect(keysOf("highland")).toContain("goat");
    expect(keysOf("climbers")).toContain("orangutan");
    expect(keysOf("crabs")).toEqual(["crab", "hermit-crab", "fiddler-crab"]);
    expect(keysOf("waders")).toContain("heron");
    expect(keysOf("fowl")).toEqual(["duck", "goose", "swan", "teal-duck"]);
    expect(keysOf("seabirds")).toEqual(["pelican", "cormorant"]);
    expect(keysOf("fresh")).toContain("koi");
    expect(keysOf("reef")).toEqual(["snapper", "angelfish", "blue-tang"]);
    expect(keysOf("turtles")).toEqual(["sea-turtle", "hawksbill"]);
    expect(keysOf("pelagic")).toContain("tuna");
    expect(keysOf("lurkers")).toContain("lobster");
    expect(keysOf("clown")).toEqual(["clownfish"]);
    expect(keysOf("mackerel")).toEqual(["mackerel"]);
    expect(keysOf("perchers")).toContain("eagle");
    expect(keysOf("sky")).toContain("sparrow");
    expect(keysOf("bloom")).toContain("monarch");
    expect(keysOf("shore")).toContain("otter");
    expect(keysOf("shore")).not.toContain("crab");
    expect(keysOf("prowlers")).toContain("tiger");
    expect(keysOf("creepers")).toContain("iguana");
    // No fish of a river shoals in the sea, and none of the reef's own swims a river.
    expect(Arr.intersection(CAST.fresh, CAST.pelagic)).toEqual([]);
    expect(Arr.intersection(CAST.reef, CAST.fresh)).toEqual([]);
  });

  it("gives a cell the same resident every day and a visitor that changes with the day", () => {
    const resident = castOf("herds", DICE, 0);
    expect(Option.isSome(resident)).toBe(true);
    expect(castOf("herds", { ...DICE, day: 20_001 }, 0)).toEqual(resident);
    const herds = Arr.map(Arr.range(0, 40), (gx) =>
      castOf("herds", { ...DICE, gx }, 0)
    );
    expect(Arr.dedupe(herds).length).toBeGreaterThan(5);
    const visitors = Arr.map(Arr.range(0, 40), (turn) =>
      castOf("prowlers", DICE, turn)
    );
    expect(Arr.dedupe(visitors).length).toBeGreaterThan(5);
    expect(
      Arr.every(Arr.getSomes(visitors), (index) =>
        Arr.contains(CAST.prowlers, index)
      )
    ).toBe(true);
    expect(
      Arr.dedupe(
        Arr.map(Arr.range(0, 40), (seed) =>
          castOf("herds", { ...DICE, seed }, 0)
        )
      ).length
    ).toBeGreaterThan(5);
  });

  it("keeps many small animals together and a few large ones, never one alone", () => {
    expect(packSize(speciesOf("mouse-deer"), 6)).toBe(6);
    expect(packSize(speciesOf("deer"), 6)).toBe(3);
    expect(packSize(speciesOf("giraffe"), 6)).toBe(2);
    expect(packSize(speciesOf("mouse-deer"), 4)).toBe(4);
  });
});
