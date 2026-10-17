import { describe, expect, it } from "@effect/vitest";
import { Animal, DESIGNS } from "@repo/mascot/animal";
import { encode, type Mascot } from "@repo/mascot/code";
import { contrast } from "@repo/mascot/ground";
import { cast, forSeed, gallery } from "@repo/mascot/seed";
import { Array as Arr } from "effect";

/** Whether the animal of a mascot stands out from its ground. */
function standsOut({ animal, ground, palette }: typeof Mascot.Type) {
  const [body] = Arr.getUnsafe(DESIGNS[animal].colors, palette);
  return contrast(body, ground) >= 2.4;
}

/** Many different seeds, such as ids. */
const SEEDS = Arr.makeBy(2000, (index) => `learner-${index}`);

describe("mascot/seed", () => {
  describe("forSeed", () => {
    it("gives three neutral seeds the mascots that Effect's hash picks, so an upgrade that changes the hash is seen", () => {
      expect(encode(forSeed("nakafa"))).toBe("crab.1.6d4b78.left.smile");
      expect(encode(forSeed("a"))).toBe("elephant.2.8c5a8f.peek-left.open");
      expect(encode(forSeed("0"))).toBe("parrot.1.4b4fb0.peek.open");
    });

    it("always gives the same mascot for the same seed", () => {
      expect(forSeed("nakafa")).toEqual(forSeed("nakafa"));
      expect(forSeed("nakafa")).not.toEqual(forSeed("nakafa-"));
    });

    it("can pick every animal", () => {
      const animals = Arr.map(SEEDS, (seed) => forSeed(seed).animal);
      expect(Arr.dedupe(animals)).toHaveLength(Animal.literals.length);
    });

    it("keeps the eyes open for most seeds, and picks the other three for the rest", () => {
      const kinds = Arr.map(SEEDS, (seed) => forSeed(seed).eyes);
      expect(Arr.dedupe(kinds)).toHaveLength(4);
      expect(
        Arr.filter(kinds, (eyes) => eyes === "open").length
      ).toBeGreaterThan(SEEDS.length / 2);
    });

    it("stands the animal out from its ground, for every seed", () => {
      expect(Arr.filter(SEEDS, (seed) => !standsOut(forSeed(seed)))).toEqual(
        []
      );
    });
  });

  describe("cast", () => {
    it("gives 65 different animals in a cast of 65, whatever the seed", () => {
      for (const seed of [
        "home",
        "pricing",
        "",
        "日本語",
        ...Arr.take(SEEDS, 20),
      ]) {
        const animals = Arr.map(cast(seed, 65), ({ animal }) => animal);
        expect(animals).toHaveLength(65);
        expect(Arr.dedupe(animals)).toHaveLength(65);
      }
    });

    it("never gives an animal twice, however many it is asked for", () => {
      for (const count of [1, 7, 16, 52, 64]) {
        const animals = Arr.map(cast("home", count), ({ animal }) => animal);
        expect(animals).toHaveLength(count);
        expect(Arr.dedupe(animals)).toHaveLength(count);
      }
    });

    it("gives no more than the animals there are, and none past the end", () => {
      expect(cast("home", 100)).toHaveLength(65);
      expect(cast("home", 0)).toEqual([]);
      expect(cast("home", 5, 65)).toEqual([]);
    });

    it("continues the same order when it skips", () => {
      expect(cast("pricing", 10, 5)).toEqual(Arr.drop(cast("pricing", 15), 5));
    });

    it("gives the same cast again, and another for another seed", () => {
      expect(cast("home", 8)).toEqual(cast("home", 8));
      expect(cast("home", 8)).not.toEqual(cast("pricing", 8));
    });

    it("stands every animal out from its ground", () => {
      expect(
        Arr.filter(cast("home", 65), (mascot) => !standsOut(mascot))
      ).toEqual([]);
    });
  });

  describe("gallery", () => {
    it("shows each animal once, in the order of the animals", () => {
      expect(Arr.map(gallery(), ({ animal }) => animal)).toEqual(
        Animal.literals
      );
    });

    it("gives the same gallery every time", () => {
      expect(gallery()).toEqual(gallery());
    });

    it("stands every animal out from its ground", () => {
      expect(Arr.filter(gallery(), (mascot) => !standsOut(mascot))).toEqual([]);
    });
  });
});
