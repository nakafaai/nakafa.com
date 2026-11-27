import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { Array as Arr, Schema } from "effect";

/** One colour as red, green and blue from 0 to 255. */
const InkSchema = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
type Ink = typeof InkSchema.Type;

/**
 * A woody stem sawn across: how many annual `rings` its wood holds, the
 * `wood` share of its radius inside the cambium, the side of the painted
 * image in pixels and which individual it is. `inks` are the colours of the
 * pale wood of spring, the dense wood of late summer, the dark heartwood, the
 * pith, the wet cambium, the inner bark and the cork.
 */
export const DiscSchema = Schema.Struct({
  inks: Schema.Struct({
    cambium: InkSchema,
    cork: InkSchema,
    early: InkSchema,
    heart: InkSchema,
    late: InkSchema,
    phloem: InkSchema,
    pith: InkSchema,
  }),
  rings: Schema.Int,
  seed: Schema.Int,
  size: Schema.Int,
  wood: Schema.Finite,
});
export type Disc = typeof DiscSchema.Type;

/** One colour, a share of the way to another. */
function mix(from: Ink, to: Ink, share: number): Ink {
  return [
    from[0] + (to[0] - from[0]) * share,
    from[1] + (to[1] - from[1]) * share,
    from[2] + (to[2] - from[2]) * share,
  ];
}

/** A step from 0 to 1 between two edges, with no corner at either. */
function ease(from: number, to: number, value: number) {
  const share = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return share * share * (3 - 2 * share);
}

/**
 * The colour of a sawn stem at one place of its face, `far` of the way from
 * its pith (0) to its bark (1) at `angle` around it. Each year lays pale
 * spring wood that darkens into a thin dense band and stops sharply at
 * winter; the old rings at the heart are darker, rays run out from the pith,
 * and outside the wood lie the wet line of the cambium, the inner bark and
 * the cracked cork. No ring is a true circle.
 */
export function discInk(disc: Disc, far: number, angle: number): Ink {
  const wobble =
    1 +
    0.04 * Math.sin(3 * angle + disc.seed) +
    0.022 * Math.sin(5 * angle + 2.1 * disc.seed) +
    0.012 * Math.sin(11 * angle + 0.7 * disc.seed);
  const reach = far / wobble;
  const ray = Math.abs(Math.cos(angle * 38 + disc.seed)) ** 40;
  if (reach < 0.022) {
    return disc.inks.pith;
  }
  if (reach < disc.wood) {
    const year = (reach / disc.wood) * disc.rings;
    const season = year - Math.floor(year);
    const spring = mix(
      disc.inks.early,
      disc.inks.heart,
      0.55 * ease(0.62, 0.42, year / disc.rings)
    );
    const grown = mix(spring, disc.inks.late, ease(0.55, 0.96, season));
    return mix(grown, disc.inks.early, 0.3 * ray);
  }
  if (reach < disc.wood + 0.018) {
    return disc.inks.cambium;
  }
  const out = (reach - disc.wood) / (1 - disc.wood);
  const crack = Math.abs(Math.cos(angle * 17 + disc.seed * 3)) ** 24;
  return mix(
    mix(disc.inks.phloem, disc.inks.pith, 0.35 * ray),
    mix(disc.inks.cork, disc.inks.pith, 0.6 * crack),
    ease(0.42, 0.52, out)
  );
}

/**
 * The face of a sawn stem as the pixels of a square image, four numbers
 * each, with the pith at its middle and the bark at its edge. Every pixel
 * carries a grain of its own, so the face is never one flat tone.
 */
export function paintDisc(disc: Disc) {
  return Uint8ClampedArray.from(
    Arr.flatMap(Arr.range(0, disc.size * disc.size - 1), (pixel) => {
      const column = pixel % disc.size;
      const row = Math.floor(pixel / disc.size);
      const x = ((column + 0.5) / disc.size) * 2 - 1;
      const y = ((row + 0.5) / disc.size) * 2 - 1;
      const grain = 0.94 + 0.12 * chanceAt(column, row, disc.seed);
      const [red, green, blue] = discInk(
        disc,
        Math.hypot(x, y),
        Math.atan2(y, x)
      );
      return [red * grain, green * grain, blue * grain, 255];
    })
  );
}
