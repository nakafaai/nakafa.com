import { fractalAt } from "@repo/design-system/components/three/field/noise";
import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import type {
  Loft,
  Station,
} from "@repo/design-system/components/three/organism/loft";
import {
  loftBody,
  ovoid,
} from "@repo/design-system/components/three/organism/loft";
import type { Color } from "three";

/** One organ or cell of soft tissue: its sections, how lobed and lumpy it is, and its two tones. */
export interface Organ {
  readonly along: number;
  readonly around: number;
  readonly deep: Color;
  readonly lobes: number;
  readonly lump: number;
  readonly pale: Color;
  readonly seed: number;
  readonly stations: readonly Station[];
}

/**
 * Lofts one organ: its own tone, mottled and darker in its creases, with
 * `lobes` swellings along it where it is coiled or sacculated.
 */
export function organ(part: Organ, detail: number): Form {
  const swell: Loft["relief"] = (along, around) =>
    part.lobes === 0
      ? 0
      : 0.16 *
        Math.sin(along * Math.PI * part.lobes + 4 * Math.sin(around * 6.283)) *
        Math.sin(Math.PI * along);
  return loftBody({
    along: faces(part.along, detail),
    around: faces(part.around, detail),
    belly: 0,
    lump: part.lump,
    paint: (along, around, color) => {
      const mottle = fractalAt(along, around, 7, 5, part.seed, 3);
      color
        .copy(part.deep)
        .lerp(part.pale, Math.min(1, 0.35 + mottle + swell(along, around)));
    },
    relief: swell,
    seed: part.seed,
    square: 2,
    stations: part.stations,
    up: [0, 0, 1],
  });
}

/**
 * One soft round body about `centre`, `radius` across its middle and a
 * little uneven: a cell, a nucleus, a polar body, a drop of fluid.
 */
export function globe(
  centre: readonly [number, number, number],
  radius: number,
  lump: number,
  deep: Color,
  pale: Color,
  detail: number
): Form {
  return organ(
    {
      along: 40,
      around: 40,
      deep,
      lobes: 0,
      lump,
      pale,
      seed: Math.round(radius * 1000),
      stations: ovoid(centre, radius * 2, radius, radius, 0),
    },
    detail
  );
}
