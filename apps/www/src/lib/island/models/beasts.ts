import { Array as Arr, Schema } from "effect";
import type { Coat, Species } from "@/lib/island/models/coat";
import {
  type Crown,
  earsOf,
  eyesOf,
  hornsOf,
  tailOf,
} from "@/lib/island/models/features";
import { type Face, mirrored, type Vec } from "@/lib/island/models/parts";
import { ball, type Ring, rod, slab, tube } from "@/lib/island/models/solids";

const Size = Schema.Struct({
  high: Schema.Finite,
  long: Schema.Finite,
  wide: Schema.Finite,
});

/**
 * A four-legged body plan (ADR 0047, D21), every length a share of the
 * shoulder's height: the body's length, depth and half width; the head's and
 * snout's; the neck's length and how steeply it rises; how far the head bows;
 * the legs' half thickness; the tail's and an ear's length; whether the feet
 * end in dark hooves; and a hump on the back.
 */
const Plan = Schema.Struct({
  body: Size,
  bow: Schema.Finite,
  ear: Schema.Finite,
  head: Size,
  hoofs: Schema.Boolean,
  hump: Schema.Finite,
  leg: Schema.Finite,
  neck: Schema.Struct({ long: Schema.Finite, rise: Schema.Finite }),
  snout: Size,
  tail: Schema.Finite,
});
type Plan = typeof Plan.Type;

/** How the body swells from the rump (0) to the chest (1). */
const PROFILE = [
  [0, 0.5],
  [0.08, 0.82],
  [0.2, 0.95],
  [0.35, 1],
  [0.5, 1],
  [0.65, 1],
  [0.8, 0.97],
  [0.92, 0.86],
  [1, 0.58],
] as const;

/** One leg from the body down to the ground, its foot a hoof when the plan says so. */
function legOf(at: Vec, top: number, plan: Plan, coat: Coat) {
  const [x, , z] = at;
  const thick = plan.leg;
  return tube(
    [
      { at: [x, top, z], high: thick * 1.25, wide: thick * 1.2 },
      { at: [x, top * 0.14, z], high: thick * 0.75, wide: thick * 0.75 },
      { at: [x, 0, z], high: thick * 0.85, wide: thick * 0.85 },
    ],
    (spot) => (plan.hoofs && spot.segment === 1 ? coat.dark : coat.leg),
    4
  );
}

/**
 * A four-legged animal at a shoulder height of one (ADR 0047, D21), standing
 * on the origin and facing +z: a lofted body in its coat and pattern, four
 * legs, a neck, a head with a snout, a nose, eyes, ears and horns by its
 * traits, a mane when it has a crest, and its tail. The catalog grows it to
 * the species' real size.
 */
export function quadruped(
  plan: Plan,
  species: Species,
  coat: Coat
): readonly Face[] {
  const { body, head, neck, snout } = plan;
  const middle = 1 - body.high / 2;
  const back = -body.long / 2;
  const rings = Arr.map(
    PROFILE,
    ([along, swell]): Ring => ({
      at: [
        0,
        middle + body.high * 0.04 * (1 - swell),
        back + body.long * along,
      ],
      high: (body.high / 2) * swell,
      wide: body.wide * swell,
    })
  );
  const [first, ...rest] = rings;
  const chest: Vec = [0, middle + body.high * 0.22, -back - body.long * 0.12];
  const throat: Vec = [
    0,
    chest[1] + neck.long * Math.sin(neck.rise),
    chest[2] + neck.long * Math.cos(neck.rise),
  ];
  const facing: Vec = [0, -Math.sin(plan.bow), Math.cos(plan.bow)];
  const along = (from: Vec, by: number): Vec => [
    from[0],
    from[1] + facing[1] * by,
    from[2] + facing[2] * by,
  ];
  const nape = along(throat, -head.long * 0.15);
  const brow = along(nape, head.long);
  const muzzle = along(brow, snout.long);
  const crown: Crown = {
    eye: [
      head.wide * 0.86,
      nape[1] + head.high * 0.25,
      along(nape, head.long * 0.62)[2],
    ],
    jaw: [0, brow[1] - snout.high * 0.6, brow[2]],
    size: head.high * 2,
    top: [0, nape[1] + head.high * 0.85, along(nape, head.long * 0.3)[2]],
    wide: head.wide,
  };
  const legX = body.wide * 0.55;
  const legZ = body.long * 0.33;
  const legs = [
    ...legOf([legX, 0, legZ], middle, plan, coat),
    ...legOf([legX, 0, -legZ], middle, plan, coat),
  ];
  const thick = Math.max(head.high * 0.7, body.high * 0.32);
  const mane = species.traits.crest
    ? slab(
        [
          [0, chest[1] + thick * 0.8, chest[2] - thick * 0.6],
          [0, throat[1] + head.high * 1.25, throat[2] - head.high * 0.55],
          [0, throat[1] + head.high * 0.4, throat[2] - head.high * 0.1],
          [0, chest[1] + thick * 0.3, chest[2]],
        ],
        head.wide * 0.6,
        coat.accent
      )
    : [];
  return [
    ...tube([first, ...rest], coat.hide, 6),
    ...legs,
    ...mirrored(legs),
    ...rod(chest, throat, [thick, head.high * 0.62], coat.hide, 6),
    ...mane,
    ...tube(
      [
        { at: nape, high: head.high * 0.78, wide: head.wide * 0.8 },
        { at: along(nape, head.long * 0.4), high: head.high, wide: head.wide },
        { at: brow, high: head.high * 0.82, wide: head.wide * 0.85 },
        {
          at: along(brow, snout.long * 0.1),
          high: snout.high,
          wide: snout.wide,
        },
        { at: muzzle, high: snout.high * 0.85, wide: snout.wide * 0.85 },
      ],
      (spot) => (spot.segment >= 2 ? coat.belly : coat.body),
      6
    ),
    ...ball(
      along(muzzle, snout.high * 0.05),
      [snout.wide * 0.55, snout.high * 0.45, snout.high * 0.18],
      coat.accent,
      1,
      6
    ),
    ...(plan.hump > 0
      ? ball(
          [0, 1 - plan.hump * 0.1, -body.long * 0.05],
          [body.wide * 0.75, plan.hump * 0.6, body.long * 0.26],
          coat.body,
          3,
          8
        )
      : []),
    ...eyesOf(crown, coat),
    ...earsOf(species.traits.ears, { ...crown, size: plan.ear * 2 }, coat),
    ...hornsOf(species.traits.horns, crown, coat),
    ...tailOf(
      species.traits.tail,
      [0, middle + body.high * 0.3, back],
      plan.tail,
      coat
    ),
  ];
}

const plan = (
  [long, high, wide]: readonly [number, number, number],
  [headLong, headHigh, headWide]: readonly [number, number, number],
  [snoutLong, snoutHigh, snoutWide]: readonly [number, number, number],
  [neckLong, rise, bow]: readonly [number, number, number],
  [leg, tail, ear]: readonly [number, number, number],
  hoofs = false,
  hump = 0
): Plan => ({
  body: { high, long, wide },
  bow,
  ear,
  head: { high: headHigh, long: headLong, wide: headWide },
  hoofs,
  hump,
  leg,
  neck: { long: neckLong, rise },
  snout: { high: snoutHigh, long: snoutLong, wide: snoutWide },
  tail,
});

/**
 * Each four-legged family's plan (ADR 0047, D21): a cat's long low body and
 * round head, a rodent's round body and big head, a hoofed grazer's deep body
 * on tall legs, a heavy beast's barrel on thick legs, a long neck raising the
 * head high, and an elephant's great body on pillars.
 */
export const PLANS = {
  heavy: plan(
    [1.5, 0.72, 0.38],
    [0.44, 0.27, 0.24],
    [0.16, 0.16, 0.16],
    [0.12, 0.25, 0.25],
    [0.13, 0.25, 0.11],
    true
  ),
  hoof: plan(
    [1.15, 0.58, 0.27],
    [0.4, 0.16, 0.13],
    [0.17, 0.11, 0.1],
    [0.4, 0.75, 0.35],
    [0.075, 0.5, 0.1],
    true
  ),
  rodent: plan(
    [1.1, 0.8, 0.36],
    [0.5, 0.36, 0.3],
    [0.12, 0.15, 0.14],
    [0.1, 0.6, 0.1],
    [0.11, 0.9, 0.24]
  ),
  small: plan(
    [1.4, 0.52, 0.23],
    [0.36, 0.2, 0.18],
    [0.14, 0.1, 0.09],
    [0.28, 0.75, 0.1],
    [0.085, 0.95, 0.15]
  ),
  tall: plan(
    [0.95, 0.46, 0.21],
    [0.34, 0.12, 0.1],
    [0.14, 0.08, 0.07],
    [0.85, 1.05, 0.2],
    [0.065, 0.45, 0.08],
    true
  ),
} satisfies Record<string, Plan>;

/** The species whose shape departs from its family's plan: a giraffe's neck, a camel's hump, a pig's snout, a sheep's fleece. */
export const TWEAKS: Partial<Record<Species["key"], Plan>> = {
  camel: {
    ...PLANS.tall,
    bow: 0.1,
    hump: 0.4,
    neck: { long: 0.62, rise: 0.5 },
  },
  giraffe: {
    ...PLANS.tall,
    body: { high: 0.44, long: 1.0, wide: 0.2 },
    neck: { long: 1.7, rise: 1.25 },
  },
  pig: {
    ...PLANS.heavy,
    snout: { high: 0.16, long: 0.14, wide: 0.17 },
    leg: 0.09,
  },
  sheep: {
    ...PLANS.hoof,
    body: { high: 0.62, long: 1.1, wide: 0.32 },
    neck: { long: 0.22, rise: 0.4 },
  },
};

/**
 * An elephant at a shoulder height of one (ADR 0047, D21): a heavy body on
 * four pillars, broad ear flaps, a trunk that hangs to the ground, and tusks
 * when the species has them.
 */
export function elephant(species: Species, coat: Coat): readonly Face[] {
  const body = quadruped(
    plan(
      [1.25, 0.62, 0.36],
      [0.42, 0.3, 0.26],
      [0.1, 0.18, 0.14],
      [0.12, 0.3, 0.3],
      [0.13, 0.4, 0.06],
      false
    ),
    { ...species, traits: { ...species.traits, ears: "none" } },
    coat
  );
  const ear = slab(
    [
      [0.2, 1.08, 0.78],
      [0.36, 1.12, 0.6],
      [0.38, 0.72, 0.58],
      [0.22, 0.6, 0.74],
    ],
    0.03,
    coat.body
  );
  const trunk = tube(
    [
      { at: [0, 0.8, 1.02], high: 0.09, wide: 0.1 },
      { at: [0, 0.55, 1.1], high: 0.07, wide: 0.075 },
      { at: [0, 0.3, 1.12], high: 0.055, wide: 0.06 },
      { at: [0, 0.12, 1.18], high: 0.045, wide: 0.05 },
    ],
    coat.body,
    5
  );
  return [...body, ...ear, ...mirrored(ear), ...trunk];
}
