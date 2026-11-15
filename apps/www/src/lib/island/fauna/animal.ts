import { Schema } from "effect";
import type { Family, Traits } from "@/lib/island/fauna/families";
import type { Ramp } from "@/lib/island/palette";
import type { markBody } from "@/lib/island/tiles/shape";

/** Where a species lives: on the land, in the sky, in the sea, on the shore, or among the flowers. */
const Home = Schema.Literals(["land", "sky", "sea", "shore", "bloom"]);
type Home = typeof Home.Type;

/**
 * One species from its parts (ADR 0047, D11): its name key (the dictionary's
 * `animal-` key), family, coat (body, belly, accent, mark), pattern, traits
 * (ears, tail, horns, crest), real height in blocks (a block is 0.9 m), and
 * home.
 */
export function animal<const Key extends string>(
  key: Key,
  family: Family,
  [body, belly, accent, mark]: readonly [Ramp, Ramp, Ramp, Ramp],
  pattern: Parameters<typeof markBody>[1],
  [ears, tail, horns, crest]: readonly [
    Traits["ears"],
    Traits["tail"],
    Traits["horns"],
    Traits["crest"],
  ],
  height: number,
  home: Home
) {
  return {
    coat: { accent, belly, body, mark },
    family,
    height,
    home,
    key,
    pattern,
    traits: { crest, ears, horns, tail },
  };
}
