import { seededUniforms } from "@repo/design-system/components/contents/mathematics/chance";
import { Array as Arr, Order, Schema } from "effect";

/**
 * Where each marble rests in the jar. Marbles lie in flat layers on the
 * jar's floor: one in the middle and rings around it, each ring as full as
 * its circumference allows with a sliver of space between neighbours, so no
 * two marbles touch through each other and none passes through the wall.
 * The colours are mixed in a fixed order, as a shaken jar mixes them.
 */

/** A 22 mm glass marble, the large size a classroom probability set uses, in metres. */
export const MARBLE_RADIUS = 0.011;

/**
 * A 1 litre glass storage jar, in metres: 10.4 cm across inside, with a
 * 6 mm floor and a 4 mm wall.
 */
export const JAR = {
  floor: 0.006,
  height: 0.16,
  innerRadius: 0.052,
  wall: 0.004,
} as const;

/** Space left between neighbouring marbles, as a share of a diameter. */
const SPACING = 1.05;

/** One resting place in the jar, in metres from the middle of its floor. */
const SlotSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});
export type Slot = typeof SlotSchema.Type;

/** The golden angle, which turns each layer so its marbles sit over the gaps below. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** The slots of one layer: the middle, then each ring that fits inside the wall. */
function layerSlots(layer: number) {
  const step = 2 * MARBLE_RADIUS * SPACING;
  const reach = JAR.innerRadius - MARBLE_RADIUS;
  const rings = Math.floor(reach / step);
  const y = JAR.floor + MARBLE_RADIUS + layer * 2 * MARBLE_RADIUS;
  const turn = layer * GOLDEN_ANGLE;
  return Arr.prepend(
    Arr.flatMap(Arr.range(1, rings), (ring) => {
      const radius = ring * step;
      const places = Math.floor((2 * Math.PI * radius) / step);
      return Arr.makeBy(places, (place) => {
        const angle = turn + (place / places) * 2 * Math.PI;
        return {
          x: radius * Math.cos(angle),
          y,
          z: radius * Math.sin(angle),
        };
      });
    }),
    { x: 0, y, z: 0 }
  );
}

/** How many marbles one layer holds. */
export const LAYER_SIZE = layerSlots(0).length;

/** The resting places of `count` marbles, filling each layer before the next. */
export function jarSlots(count: number): readonly Slot[] {
  const layers = Math.ceil(count / LAYER_SIZE);
  return Arr.take(
    Arr.flatMap(Arr.range(0, Math.max(0, layers - 1)), layerSlots),
    count
  );
}

/**
 * Which slot each marble of the jar rests in: the slots sorted by a seeded
 * key, a fixed shuffle, so the colours lie mixed through the jar.
 */
export function mixedSlots(count: number, seed: number) {
  const keys = seededUniforms(seed, count);
  return Arr.map(
    Arr.sort(
      Arr.makeBy(count, (slot) => ({ key: Arr.getUnsafe(keys, slot), slot })),
      Order.mapInput(
        Order.Number,
        (entry: { readonly key: number }) => entry.key
      )
    ),
    (entry) => entry.slot
  );
}

/** The height of the top of the pile, where a drawn marble comes out of it. */
export function pileTop(slots: readonly Slot[]) {
  const highest = Arr.reduce(slots, 0, (top, slot) =>
    Math.max(top, slot.y + MARBLE_RADIUS)
  );
  return Math.max(JAR.floor, highest);
}
