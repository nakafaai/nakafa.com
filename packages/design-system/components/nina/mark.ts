import type { Mark } from "@repo/mascot/nina/mark";
import { Match } from "effect";

/**
 * What a mark of hers says about its element: which limb it is, which layer of
 * her figure it holds, or that it is an open eye. Her life and the tests find
 * the element by it.
 */
export function marked(mark: Mark) {
  return Match.valueTags(mark, {
    eye: () => ({ "data-eye": "true" }),
    limb: ({ name }) => ({ "data-limb": name }),
    part: ({ name }) => ({ "data-part": name }),
  });
}
