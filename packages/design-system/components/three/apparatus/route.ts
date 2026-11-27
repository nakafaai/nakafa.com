import { PointSchema } from "@repo/design-system/components/three/form/path";
import { Schema } from "effect";

/**
 * A 4 mm test lead between two places on a bench: a flexible insulated
 * cable that leaves each fitting along the fitting's own axis, upward, and
 * hangs in one easy curve between them, as a real lead does. The same
 * route draws the cable and carries whatever a lesson shows moving along it.
 */

/** What a lead ends in: a stackable plug in a post, a crocodile clip on a plate, or the bare cable. */
const EndSchema = Schema.Literals(["bare", "clip", "plug"]);

/** How tall each fitting is, from the place it grips to where its cable leaves it, in metres. */
export const FITTING = { bare: 0, clip: 0.03, plug: 0.03 } as const;

/** How far a cable runs straight out of its fitting before it bends. */
const STIFF = 0.022;

/**
 * A lead as an author states it: the two places it grips, what it ends in
 * at each, and its `lift`: how far its middle stands above the straight
 * line between its ends, or hangs below it when negative, in metres.
 */
const LeadSchema = Schema.Struct({
  ends: Schema.Tuple([EndSchema, EndSchema]),
  from: PointSchema,
  lift: Schema.Finite,
  to: PointSchema,
});
export type Lead = typeof LeadSchema.Type;

/**
 * The line a lead's cable follows, as the points of a smooth curve: out of
 * the top of its first fitting, straight up while the cable is stiff, over
 * its lifted or hanging middle, and straight down into its second fitting.
 */
export function routeOf(lead: Lead) {
  const [fromX, fromY, fromZ] = lead.from;
  const [toX, toY, toZ] = lead.to;
  const start = fromY + FITTING[lead.ends[0]];
  const end = toY + FITTING[lead.ends[1]];
  const lean = 0.12;
  return [
    [fromX, start, fromZ],
    [fromX + (toX - fromX) * lean, start + STIFF, fromZ + (toZ - fromZ) * lean],
    [
      (fromX + toX) / 2,
      (start + end) / 2 + STIFF + lead.lift,
      (fromZ + toZ) / 2,
    ],
    [toX - (toX - fromX) * lean, end + STIFF, toZ - (toZ - fromZ) * lean],
    [toX, end, toZ],
  ] as const;
}
