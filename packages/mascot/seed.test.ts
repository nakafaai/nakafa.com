import { describe, expect, it } from "@effect/vitest";
import { Animal, DESIGNS } from "@repo/mascot/animal";
import { decode, encode, type Mascot } from "@repo/mascot/code";
import { contrast } from "@repo/mascot/ground";
import reference from "@repo/mascot/reference/seed.json" with { type: "json" };
import { cast, forSeed, gallery, hash, reroll } from "@repo/mascot/seed";
import { Array as Arr, Record as Rec, Result } from "effect";

/** The mascot of a code that is known to be good. */
function mascotOf(code: string) {
  return Result.getOrThrow(decode(code));
}

/** The codes of some mascots, as one text. */
function codesOf(mascots: readonly (typeof Mascot.Type)[]) {
  return Arr.join(Arr.map(mascots, encode), " ");
}

/** Whether the animal of a mascot stands out from its ground. */
function standsOut({ animal, ground, palette }: typeof Mascot.Type) {
  const [body] = Arr.getUnsafe(DESIGNS[animal].colors, palette);
  return contrast(body, ground) >= 2.4;
}

/** Many different seeds, such as ids. */
const SEEDS = Arr.makeBy(2000, (index) => `learner-${index}`);

describe("mascot/seed", () => {
  describe("hash", () => {
    it("hashes text as the prototype does, also Unicode, emoji, and the empty text", () => {
      const entries = Rec.toEntries(reference.hashes);
      expect(entries.length).toBeGreaterThan(40);
      expect(
        Arr.filter(entries, ([text, value]) => hash(text) !== value)
      ).toEqual([]);
    });

    it("hashes the empty text to the FNV offset basis", () => {
      expect(hash("")).toBe(2_166_136_261);
    });

    it("continues the hash of the text before it", () => {
      for (const [first, second] of [
        ["Nabil", "#warna"],
        ["", "abc"],
        ["abc", ""],
        ["日本", "語🙂"],
      ]) {
        expect(hash(second, hash(first))).toBe(hash(first + second));
      }
    });
  });

  describe("forSeed", () => {
    it("gives a seed the mascot that the prototype gives it", () => {
      const entries = Rec.toEntries(reference.codes);
      expect(entries.length).toBeGreaterThan(40);
      expect(
        Arr.filter(entries, ([seed, code]) => encode(forSeed(seed)) !== code)
      ).toEqual([]);
    });

    it("always gives the same mascot for the same seed", () => {
      expect(forSeed("Nabil Akbarazzima Fatih - nabilfatih")).toEqual(
        forSeed("Nabil Akbarazzima Fatih - nabilfatih")
      );
      expect(forSeed("Nabil")).not.toEqual(forSeed("Nabila"));
    });

    it("can pick every animal", () => {
      const animals = Arr.map(SEEDS, (seed) => forSeed(seed).animal);
      expect(Arr.dedupe(animals)).toHaveLength(Animal.literals.length);
    });

    it("stands the animal out from its ground, for every seed", () => {
      expect(Arr.filter(SEEDS, (seed) => !standsOut(forSeed(seed)))).toEqual(
        []
      );
    });
  });

  describe("cast", () => {
    it("gives the casts of the prototype", () => {
      expect(reference.casts.length).toBeGreaterThan(10);
      expect(
        Arr.filter(
          reference.casts,
          ({ codes, count, seed, skip }) =>
            codesOf(cast(seed, count, skip)) !== Arr.join(codes, " ")
        )
      ).toEqual([]);
    });

    it("gives 65 different animals in a cast of 65, whatever the seed", () => {
      for (const seed of [
        "beranda",
        "harga",
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
        const animals = Arr.map(cast("beranda", count), ({ animal }) => animal);
        expect(animals).toHaveLength(count);
        expect(Arr.dedupe(animals)).toHaveLength(count);
      }
    });

    it("gives no more than the animals there are, and none past the end", () => {
      expect(cast("beranda", 100)).toHaveLength(65);
      expect(cast("beranda", 0)).toEqual([]);
      expect(cast("beranda", 5, 65)).toEqual([]);
    });

    it("continues the same order when it skips", () => {
      expect(cast("harga", 10, 5)).toEqual(Arr.drop(cast("harga", 15), 5));
    });

    it("stands every animal out from its ground", () => {
      expect(
        Arr.filter(cast("beranda", 65), (mascot) => !standsOut(mascot))
      ).toEqual([]);
    });
  });

  describe("reroll", () => {
    it("gives the rerolls of the prototype", () => {
      expect(reference.rerolls.length).toBeGreaterThan(40);
      expect(
        Arr.filter(
          reference.rerolls,
          ({ codes, count, current, seed }) =>
            codesOf(reroll(seed, mascotOf(current), count)) !==
            Arr.join(codes, " ")
        )
      ).toEqual([]);
    });

    it("never gives the current animal back, whoever asks", () => {
      const clashes = Arr.filter(Arr.take(SEEDS, 300), (seed) => {
        const current = forSeed(seed);
        return Arr.some(
          reroll(seed, current, 5),
          ({ animal }) => animal === current.animal
        );
      });
      expect(clashes).toEqual([]);
    });

    it("gives as many as are asked for, each one different", () => {
      const current = forSeed("Nabil");
      const others = reroll("Nabil", current, 8);
      expect(others).toHaveLength(8);
      expect(Arr.dedupe(Arr.map(others, encode))).toHaveLength(8);
    });

    it("gives the same rerolls again, and others for another current mascot", () => {
      const current = forSeed("Nabil");
      expect(reroll("Nabil", current, 3)).toEqual(reroll("Nabil", current, 3));
      expect(reroll("Nabil", current, 3)).not.toEqual(
        reroll("Nabil", forSeed("Nabila"), 3)
      );
    });

    it("gives nothing when none is asked for", () => {
      expect(reroll("Nabil", forSeed("Nabil"), 0)).toEqual([]);
    });

    it("stands every animal out from its ground", () => {
      const rerolled = reroll("Nabil", forSeed("Nabil"), 65);
      expect(Arr.filter(rerolled, (mascot) => !standsOut(mascot))).toEqual([]);
    });
  });

  describe("gallery", () => {
    it("shows each animal once, in order, as the prototype does", () => {
      const shown = gallery();
      expect(Arr.map(shown, encode)).toEqual(reference.gallery);
      expect(Arr.map(shown, ({ animal }) => animal)).toEqual(Animal.literals);
    });

    it("stands every animal out from its ground", () => {
      expect(Arr.filter(gallery(), (mascot) => !standsOut(mascot))).toEqual([]);
    });
  });
});
