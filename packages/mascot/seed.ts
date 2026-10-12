import { Animal, DESIGNS } from "@repo/mascot/animal";
import { encode, Mascot } from "@repo/mascot/code";
import { groundsFor } from "@repo/mascot/ground";
import { Eyes } from "@repo/mascot/kit";
import { POSE_ORDER } from "@repo/mascot/pose";
import { Array as Arr, Hash, Order } from "effect";

/**
 * How many shifts of a seed `reroll` tries, and so how far it looks for animals
 * other than the current one.
 */
const REROLL_TRIES = 200;

/**
 * The number that a text stands for. `Hash.string` can be negative, so a pick
 * takes the remainder of its absolute value. A part of a mascot that needs a
 * number of its own hashes the seed with a tag, such as `${seed}#palette`.
 */
function hashed(text: string) {
  return Math.abs(Hash.string(text));
}

/** The grounds that the body of one palette of an animal stands out from. */
function groundsOf(animal: typeof Animal.Type, palette: number) {
  const [body] = Arr.getUnsafe(DESIGNS[animal].colors, palette);
  return groundsFor(body);
}

/**
 * The mascot that a seed, such as a name or an id, gives. It is always the
 * same, and each part of it comes from a tag of its own.
 */
export function forSeed(seed: string) {
  const animal = Arr.getUnsafe(
    Animal.literals,
    hashed(seed) % Animal.literals.length
  );
  const palette = hashed(`${seed}#palette`) % DESIGNS[animal].colors.length;
  const grounds = groundsOf(animal, palette);
  const mood = hashed(`${seed}#eyes`);
  return Mascot.make({
    animal,
    eyes: Arr.getUnsafe(Eyes.literals, mood % 8 < 5 ? 0 : 1 + (mood % 3)),
    ground: Arr.getUnsafe(grounds, hashed(`${seed}#ground`) % grounds.length),
    palette,
    pose: Arr.getUnsafe(POSE_ORDER, hashed(`${seed}#pose`) % POSE_ORDER.length),
  });
}

/**
 * Other mascots for the same person, never the same animal as the current one.
 * It tries shifted seeds in turn, so asking again gives the same answer.
 */
export function reroll(
  seed: string,
  current: typeof Mascot.Type,
  count: number
) {
  const prefix = `${seed}:${encode(current)}`;
  const gather = (
    shift: number,
    found: readonly (typeof Mascot.Type)[]
  ): readonly (typeof Mascot.Type)[] => {
    if (found.length >= count || shift >= REROLL_TRIES) {
      return found;
    }
    const next = forSeed(`${prefix}#${shift}`);
    const fresh = next.animal !== current.animal && !Arr.contains(found, next);
    return gather(shift + 1, fresh ? Arr.append(found, next) : found);
  };
  return gather(1, []);
}

/**
 * A cast: up to `count` different animals for one seed, never the same animal
 * twice. Marketing art and the pit take their animals from one cast, so a page
 * never shows two of a kind. `skip` starts further down the same order.
 */
export function cast(seed: string, count: number, skip = 0) {
  const order = Arr.sort(
    Arr.map(Animal.literals, (animal) => ({
      animal,
      key: Hash.string(`${seed}#${animal}`),
    })),
    Order.Struct({ key: Order.Number, animal: Order.String })
  );
  const lean = hashed(`${seed}#pose`);
  return Arr.map(
    Arr.take(Arr.drop(order, skip), count),
    ({ animal }, offset) => {
      const place = skip + offset;
      const text = `${seed}#${animal}`;
      const palette = hashed(`${text}#palette`) % DESIGNS[animal].colors.length;
      const grounds = groundsOf(animal, palette);
      return Mascot.make({
        animal,
        eyes: "open",
        ground: Arr.getUnsafe(
          grounds,
          (hashed(`${text}#ground`) + place) % grounds.length
        ),
        palette,
        pose: Arr.getUnsafe(POSE_ORDER, (lean + place) % POSE_ORDER.length),
      });
    }
  );
}

/** One mascot per animal, in the order of the animals, for a gallery. */
export function gallery() {
  return Arr.map(Animal.literals, (animal) => {
    const grounds = groundsOf(animal, 0);
    return Mascot.make({
      animal,
      eyes: "open",
      ground: Arr.getUnsafe(grounds, hashed(animal) % grounds.length),
      palette: 0,
      pose: Arr.getUnsafe(
        POSE_ORDER,
        hashed(`${animal}#pose`) % POSE_ORDER.length
      ),
    });
  });
}
