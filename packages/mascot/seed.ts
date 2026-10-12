import { Animal, DESIGNS } from "@repo/mascot/animal";
import { encode, Mascot } from "@repo/mascot/code";
import { groundsFor } from "@repo/mascot/ground";
import { Eyes } from "@repo/mascot/kit";
import { POSE_ORDER } from "@repo/mascot/pose";
import { Array as Arr, Order } from "effect";

/** Every 32-bit word is an unsigned integer below this. */
const WORD = 2 ** 32;

/** The FNV-1a offset basis and prime for 32 bits. */
const FNV_OFFSET = 2_166_136_261;
const FNV_PRIME = 16_777_619;

/**
 * How many shifts of a seed `reroll` tries, and so how far it looks for animals
 * other than the current one.
 */
const REROLL_TRIES = 200;

/**
 * `a` XOR `b` for non-negative integers, worked out bit by bit from the low
 * end. Biome bans the bitwise operators, and the hash below needs this one.
 */
function xor(a: number, b: number): number {
  return b === 0
    ? a
    : ((a + b) % 2) + 2 * xor(Math.floor(a / 2), Math.floor(b / 2));
}

/**
 * FNV-1a over the UTF-16 code units of a text, as an unsigned 32-bit integer.
 * It starts from `state`, the hash of the text before, so the hash of one text
 * that follows another continues the hash of the first:
 * `hash(a + b)` is `hash(b, hash(a))`.
 */
export function hash(text: string, state = FNV_OFFSET) {
  return Arr.reduce(
    Arr.map(text.split(""), (unit) => unit.charCodeAt(0)),
    state,
    (current, unit) => {
      const product = Math.imul(xor(current, unit), FNV_PRIME);
      return product < 0 ? product + WORD : product;
    }
  );
}

/**
 * The mascot that the hash of a seed gives. Each part of it, from the palette
 * to the pose, continues that hash with a tag of its own.
 */
function pick(base: number) {
  const animal = Arr.getUnsafe(Animal.literals, base % Animal.literals.length);
  const { colors } = DESIGNS[animal];
  const palette = hash("#warna", base) % colors.length;
  const grounds = groundsFor(Arr.getUnsafe(colors, palette)[0]);
  const mood = hash("#mata", base);
  return Mascot.make({
    animal,
    eyes: Arr.getUnsafe(Eyes.literals, mood % 8 < 5 ? 0 : 1 + (mood % 3)),
    ground: Arr.getUnsafe(grounds, hash("#latar", base) % grounds.length),
    palette,
    pose: Arr.getUnsafe(POSE_ORDER, hash("#pose", base) % POSE_ORDER.length),
  });
}

/** The mascot that a seed, such as a name or an id, gives. It is always the same. */
export function forSeed(seed: string) {
  return pick(hash(seed));
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
  const prefix = hash(`${seed}:${encode(current)}`);
  const gather = (
    shift: number,
    found: readonly (typeof Mascot.Type)[]
  ): readonly (typeof Mascot.Type)[] => {
    if (found.length >= count || shift >= REROLL_TRIES) {
      return found;
    }
    const next = pick(hash(`#${shift}`, prefix));
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
  const base = hash(seed);
  const prefix = hash("#", base);
  const pose = hash("#pose", base);
  const order = Arr.sort(
    Arr.map(Animal.literals, (animal) => ({
      animal,
      key: hash(animal, prefix),
    })),
    Order.Struct({ key: Order.Number, animal: Order.String })
  );
  return Arr.map(
    Arr.take(Arr.drop(order, skip), count),
    ({ animal, key }, offset) => {
      const place = skip + offset;
      const { colors } = DESIGNS[animal];
      const palette = hash("#warna", key) % colors.length;
      const grounds = groundsFor(Arr.getUnsafe(colors, palette)[0]);
      return Mascot.make({
        animal,
        eyes: "titik",
        ground: Arr.getUnsafe(
          grounds,
          (hash("#latar", key) + place) % grounds.length
        ),
        palette,
        pose: Arr.getUnsafe(POSE_ORDER, (pose + place) % POSE_ORDER.length),
      });
    }
  );
}

/** One mascot per animal, in the order of the animals, for a gallery. */
export function gallery() {
  return Arr.map(Animal.literals, (animal) => {
    const key = hash(animal);
    const grounds = groundsFor(Arr.getUnsafe(DESIGNS[animal].colors, 0)[0]);
    return Mascot.make({
      animal,
      eyes: "titik",
      ground: Arr.getUnsafe(grounds, key % grounds.length),
      palette: 0,
      pose: Arr.getUnsafe(POSE_ORDER, hash("#pose", key) % POSE_ORDER.length),
    });
  });
}
