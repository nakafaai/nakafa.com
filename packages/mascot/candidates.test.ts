import { describe, expect, it } from "@effect/vitest";
import { Animal, DESIGNS } from "@repo/mascot/animal";
import { anotherMascot, candidates } from "@repo/mascot/candidates";
import { encode, type Mascot, MascotCode } from "@repo/mascot/code";
import { contrast } from "@repo/mascot/ground";
import { Array as Arr, Effect, Random, Schema } from "effect";

/** Many different seeds for the Random service. */
const SEEDS = Arr.makeBy(300, (index) => index);

/** The animal that a seed leaves out of its set. */
function currentOf(seed: number) {
  return Arr.getUnsafe(Animal.literals, seed % Animal.literals.length);
}

/** One set of candidates, drawn with a seeded Random service. */
function draw(seed: number, count: number, current?: typeof Animal.Type) {
  return candidates(count, current).pipe(Random.withSeed(seed));
}

/** The animals of a set of mascots. */
function animalsOf(mascots: readonly (typeof Mascot.Type)[]) {
  return Arr.map(mascots, ({ animal }) => animal);
}

/** Whether the animal of a mascot stands out from its ground. */
function standsOut({ animal, ground, palette }: typeof Mascot.Type) {
  const [body] = Arr.getUnsafe(DESIGNS[animal].colors, palette);
  return contrast(body, ground) >= 2.4;
}

describe("mascot/candidates", () => {
  it.effect("never gives the current animal back, for any seed", () =>
    Effect.gen(function* () {
      const clashes = yield* Effect.filter(SEEDS, (seed) =>
        Effect.map(draw(seed, 4, currentOf(seed)), (mascots) =>
          Arr.contains(animalsOf(mascots), currentOf(seed))
        )
      );
      expect(clashes).toEqual([]);
    })
  );

  it.effect(
    "gives as many as are asked for, and never the same animal twice",
    () =>
      Effect.gen(function* () {
        const sets = yield* Effect.forEach(SEEDS, (seed) => draw(seed, 4));
        const broken = Arr.filter(sets, (mascots) => {
          const animals = animalsOf(mascots);
          return animals.length !== 4 || Arr.dedupe(animals).length !== 4;
        });
        expect(broken).toEqual([]);
      })
  );

  it.effect(
    "gives every other animal and no more when all of them are asked for",
    () =>
      Effect.gen(function* () {
        const animals = animalsOf(yield* draw(1, 100, "cat"));
        expect(animals).toHaveLength(Animal.literals.length - 1);
        expect(Arr.dedupe(animals)).toHaveLength(Animal.literals.length - 1);
        expect(Arr.contains(animals, "cat")).toBe(false);
      })
  );

  it.effect("may give any animal when there is no current one", () =>
    Effect.gen(function* () {
      const animals = animalsOf(yield* draw(1, 100));
      expect(Arr.dedupe(animals)).toHaveLength(Animal.literals.length);
    })
  );

  it.effect("gives no candidates when none is asked for", () =>
    Effect.gen(function* () {
      expect(yield* draw(1, 0)).toEqual([]);
    })
  );

  it.effect(
    "gives the same set again for the same seed, and another set for another seed",
    () =>
      Effect.gen(function* () {
        const first = yield* draw(7, 4, "cat");
        expect(yield* draw(7, 4, "cat")).toEqual(first);
        expect(yield* draw(8, 4, "cat")).not.toEqual(first);
      })
  );

  it.effect(
    "gives mascots that stand out from their ground, for every seed",
    () =>
      Effect.gen(function* () {
        const sets = yield* Effect.forEach(SEEDS, (seed) => draw(seed, 4));
        const flat = Arr.filter(
          Arr.flatten(sets),
          (mascot) => !standsOut(mascot)
        );
        expect(flat).toEqual([]);
      })
  );

  it.effect(
    "gives mascots whose stored codes read back as the same mascot",
    () =>
      Effect.gen(function* () {
        const sets = yield* Effect.forEach(SEEDS, (seed) => draw(seed, 4));
        for (const mascot of Arr.flatten(sets)) {
          const read = yield* Schema.decodeEffect(MascotCode)(encode(mascot));
          expect(read).toEqual(mascot);
        }
      })
  );

  it.effect(
    "shuffles to an animal other than the current one, for every seed",
    () =>
      Effect.gen(function* () {
        const shuffles = yield* Effect.forEach(SEEDS, (seed) =>
          Effect.map(
            anotherMascot(currentOf(seed)).pipe(Random.withSeed(seed)),
            (mascot) => ({ current: currentOf(seed), mascot })
          )
        );
        const clashes = Arr.filter(
          shuffles,
          ({ current, mascot }) => mascot.animal === current
        );
        expect(clashes).toEqual([]);
      })
  );

  it.effect("gives the same shuffle again for the same seed", () =>
    Effect.gen(function* () {
      const first = yield* anotherMascot("cat").pipe(Random.withSeed(7));
      expect(yield* anotherMascot("cat").pipe(Random.withSeed(7))).toEqual(
        first
      );
    })
  );
});
