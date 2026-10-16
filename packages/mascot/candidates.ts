import { Animal, DESIGNS } from "@repo/mascot/animal";
import { Mascot } from "@repo/mascot/code";
import { POSE_ORDER } from "@repo/mascot/pose";
import { groundsOf } from "@repo/mascot/seed";
import { Array as Arr, Effect, Random } from "effect";

/**
 * One element of a list that holds at least one element, drawn by the Random
 * service. Every list here has one: every animal has a palette, and every
 * palette has a ground that stands out from its body.
 */
const drawOne = <A>(elements: readonly A[]) =>
  Random.nextIntBetween(0, elements.length, { halfOpen: true }).pipe(
    Effect.map((index) => Arr.getUnsafe(elements, index))
  );

/** A mascot of one animal, with a palette, a ground that stands out from it, and a pose. */
const drawMascot = Effect.fn("mascot.candidate")(function* (
  animal: typeof Animal.Type
) {
  const palette = yield* Random.nextIntBetween(
    0,
    DESIGNS[animal].colors.length,
    { halfOpen: true }
  );
  const ground = yield* drawOne(groundsOf(animal, palette));
  const pose = yield* drawOne(POSE_ORDER);
  return Mascot.make({ animal, eyes: "open", ground, palette, pose });
});

/**
 * Up to `count` mascots for a person to choose from. No two are the same animal,
 * and none is the animal `current` when there is one. Every choice comes from
 * the Random service, so a seeded service gives the same set again and the
 * default service gives a new set each time.
 */
export const candidates = Effect.fn("mascot.candidates")(function* (
  count: number,
  current?: typeof Animal.Type
) {
  const others = Arr.filter(Animal.literals, (animal) => animal !== current);
  const animals = Arr.take(yield* Random.shuffle(others), count);
  return yield* Effect.forEach(animals, drawMascot);
});
