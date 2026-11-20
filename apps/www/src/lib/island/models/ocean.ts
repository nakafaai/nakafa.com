import { Array as Arr, Match, Schema } from "effect";
import type { Face, Rgb, Rig, Vec } from "@/lib/island/models/parts";
import { meters as m, mirrored, rgb, rigged } from "@/lib/island/models/parts";
import type { Ring } from "@/lib/island/models/solids";
import { scaled, slab, tube } from "@/lib/island/models/solids";
import { unitOf } from "@/lib/island/noise";

/** The open sea's big swimmers (ADR 0047, D24), beside the lane's humpback whale. */
export const Swimmer = Schema.Literals([
  "reef-shark",
  "tiger-shark",
  "hammerhead",
  "whale-shark",
  "dolphin",
  "orca",
]);
export type Swimmer = typeof Swimmer.Type;

/**
 * Each swimmer's real length in meters and its colors (ADR 0047, D24): a back
 * over a pale belly, the color of its fins and of its marks.
 */
const LOOKS = {
  dolphin: {
    back: 0x6f_7f_8f,
    belly: 0xe4_e8_ec,
    length: 2.8,
    mark: 0x8f_9c_a8,
  },
  hammerhead: {
    back: 0x7a_86_8c,
    belly: 0xe8_e4_dc,
    length: 4,
    mark: 0x5f_6a_70,
  },
  orca: { back: 0x1e_20_24, belly: 0xf4_f4_f2, length: 7, mark: 0xf4_f4_f2 },
  "reef-shark": {
    back: 0x8a_8f_8a,
    belly: 0xec_e8_de,
    length: 1.8,
    mark: 0x26_2a_2c,
  },
  "tiger-shark": {
    back: 0x7d_76_62,
    belly: 0xec_e6_d6,
    length: 4,
    mark: 0x52_4a_3a,
  },
  "whale-shark": {
    back: 0x3c_4c_62,
    belly: 0xec_ec_e6,
    length: 10,
    mark: 0xf2_f2_ec,
  },
} satisfies Record<Swimmer, Record<string, number>>;

/** A sea body of one length, centered on the origin and facing +z, as a share-of-length plan of its hull and fins. */
function hullOf(
  shape: readonly (readonly [number, number, number])[],
  paint: (along: number, up: number) => Rgb
) {
  const rings = Arr.map(
    shape,
    ([along, wide, high], index): Ring => ({
      at: [0, 0, 0.5 - along],
      high: index === 0 || index === shape.length - 1 ? 0 : high,
      wide: index === 0 || index === shape.length - 1 ? 0 : wide,
    })
  );
  const [first, ...rest] = rings;
  return tube([first, ...rest], (spot) => paint(spot.along, spot.up), 8);
}

/**
 * A flat fin in its own plane (ADR 0047, D49): each point is how far out along
 * `out` and how far back along `back` from `root`, so a falcate fin keeps its
 * curve and every corner lies in one plane, as a slab must.
 */
function planarFin(
  root: Vec,
  out: Vec,
  back: Vec,
  points: Arr.NonEmptyReadonlyArray<readonly [number, number]>,
  color: Rgb
): readonly Face[] {
  return slab(
    Arr.map(
      points,
      ([along, behind]): Vec => [
        root[0] + out[0] * along + back[0] * behind,
        root[1] + out[1] * along + back[1] * behind,
        root[2] + out[2] * along + back[2] * behind,
      ]
    ),
    0.008,
    color
  );
}

/** A fin in the body's middle plane (x = 0), from its outline as (up, along) pairs. */
function keelFin(
  points: Arr.NonEmptyReadonlyArray<readonly [number, number]>,
  color: Rgb
): readonly Face[] {
  return slab(
    Arr.map(points, ([up, z]): Vec => [0, up, z]),
    0.01,
    color
  );
}

/**
 * A shark from its anatomy (ADR 0047, D24 and D49), one long from its snout to
 * the tip of its tail, facing +z: a torpedo with a pointed snout and a narrow
 * tail stock, a tall falcate first dorsal fin with a hollow trailing edge, a
 * small second dorsal and anal fin, long falcate pectoral fins swept back and
 * down, small pelvic fins, five gill slits, and a heterocercal tail whose
 * upper lobe is longer and angled up over a shorter lower lobe. A hammerhead
 * carries its flat, scalloped head blade with an eye at each tip and a taller
 * dorsal fin; a whale shark a broad flat head, a white-spotted back and a
 * deeper, near-even tail.
 */
function sharkFaces(
  kind: Exclude<Swimmer, "dolphin" | "orca">
): readonly Face[] {
  const look = LOOKS[kind];
  const [back, belly, mark] = [rgb(look.back), rgb(look.belly), rgb(look.mark)];
  const ink = rgb(0x15_15_18);
  const whale = kind === "whale-shark";
  const hammer = kind === "hammerhead";
  const paint = (along: number, up: number) => {
    if (up < -0.3) {
      return belly;
    }
    const spotted =
      (whale && up > 0 && Math.floor(along * 23 + up * 5) % 3 === 0) ||
      (kind === "tiger-shark" && Math.floor(along * 10) % 3 === 1);
    return spotted ? mark : back;
  };
  const hull = hullOf(
    [
      [0, 0, 0],
      [0.03, whale ? 0.07 : 0.022, whale ? 0.03 : 0.018],
      [0.08, whale ? 0.085 : 0.048, whale ? 0.05 : 0.042],
      [0.18, 0.072, 0.068],
      [0.32, 0.078, 0.074],
      [0.5, 0.062, 0.06],
      [0.66, 0.04, 0.042],
      [0.8, 0.017, 0.02],
      [0.86, 0, 0],
    ],
    paint
  );
  const pectoral = planarFin(
    [0.05, -0.04, 0.17],
    [0.92, -0.33, -0.2],
    [0, 0, -1],
    [
      [0, 0],
      [0.12, 0.03],
      [0.24, 0.09],
      [0.25, 0.12],
      [0.17, 0.11],
      [0.08, 0.09],
      [0, 0.08],
    ],
    back
  );
  const pelvic = planarFin(
    [0.03, -0.045, -0.1],
    [0.8, -0.6, 0],
    [0, 0, -1],
    [
      [0, 0],
      [0.06, 0.03],
      [0.06, 0.05],
      [0, 0.05],
    ],
    back
  );
  const gills = Arr.flatMap(
    Arr.makeBy(5, (index) => index),
    (index) =>
      slab(
        [
          [0.07, 0.02, 0.27 - index * 0.018],
          [0.07, -0.025, 0.268 - index * 0.018],
          [0.07, -0.025, 0.264 - index * 0.018],
          [0.07, 0.02, 0.266 - index * 0.018],
        ],
        0.004,
        mark
      )
  );
  const blade = hammer
    ? slab(
        [
          [-0.15, 0.01, 0.43],
          [-0.1, 0.01, 0.465],
          [-0.045, 0.01, 0.485],
          [0, 0.01, 0.47],
          [0.045, 0.01, 0.485],
          [0.1, 0.01, 0.465],
          [0.15, 0.01, 0.43],
          [0.14, 0.01, 0.405],
          [0.05, 0.01, 0.405],
          [0.03, 0.01, 0.385],
          [-0.03, 0.01, 0.385],
          [-0.05, 0.01, 0.405],
          [-0.14, 0.01, 0.405],
        ],
        0.022,
        back
      )
    : [];
  const eye = hammer
    ? slab(
        [
          [0.15, 0.024, 0.425],
          [0.158, 0.024, 0.418],
          [0.15, 0.024, 0.411],
        ],
        0.012,
        ink
      )
    : slab(
        [
          [0.033, 0.016, 0.405],
          [0.037, 0.026, 0.398],
          [0.037, 0.014, 0.392],
        ],
        0.006,
        ink
      );
  return [
    ...hull,
    ...keelFin(
      hammer
        ? [
            [0.06, 0.13],
            [0.27, 0.04],
            [0.26, 0.01],
            [0.13, 0.02],
            [0.07, -0.02],
          ]
        : [
            [0.065, 0.13],
            [0.21, 0.02],
            [0.2, -0.005],
            [0.12, 0.005],
            [0.07, -0.02],
          ],
      back
    ),
    ...keelFin(
      [
        [0.03, -0.21],
        [0.075, -0.25],
        [0.025, -0.265],
      ],
      back
    ),
    ...keelFin(
      [
        [-0.03, -0.21],
        [-0.07, -0.255],
        [-0.025, -0.265],
      ],
      back
    ),
    ...keelFin(
      whale
        ? [
            [0.02, -0.33],
            [0.2, -0.49],
            [0.16, -0.5],
            [0.03, -0.44],
            [-0.14, -0.5],
            [-0.17, -0.48],
            [-0.01, -0.35],
          ]
        : [
            [0.02, -0.33],
            [0.1, -0.41],
            [0.19, -0.495],
            [0.165, -0.5],
            [0.09, -0.465],
            [0.04, -0.45],
            [-0.03, -0.445],
            [-0.1, -0.47],
            [-0.065, -0.42],
            [-0.01, -0.35],
          ],
      back
    ),
    ...pectoral,
    ...mirrored(pectoral),
    ...pelvic,
    ...mirrored(pelvic),
    ...(whale ? [] : [...gills, ...mirrored(gills)]),
    ...blade,
    ...eye,
    ...mirrored(eye),
  ];
}

/** A dolphin or an orca (ADR 0047, D24): a sleek body with a beak or a round head, a curved back fin, and flat flukes. */
function dolphinFaces(kind: "dolphin" | "orca"): readonly Face[] {
  const look = LOOKS[kind];
  const [back, belly, mark] = [rgb(look.back), rgb(look.belly), rgb(look.mark)];
  const orca = kind === "orca";
  const paint = (_along: number, up: number) => (up < -0.3 ? belly : back);
  const patch = orca
    ? slab(
        [
          [0.07, 0.03, 0.34],
          [0.085, 0.045, 0.24],
          [0.08, 0.015, 0.22],
        ],
        0.006,
        mark
      )
    : [];
  const flipper = slab(
    [
      [0.06, -0.05, 0.2],
      [0.18, -0.12, 0.1],
      [0.07, -0.06, 0.12],
    ],
    0.01,
    back
  );
  // A swept, lunate fluke wing with a notch at the middle of its trailing edge (D48).
  const fluke = slab(
    [
      [0.01, 0, -0.4],
      [0.09, 0, -0.43],
      [0.17, 0, -0.5],
      [0.13, 0, -0.49],
      [0.07, 0, -0.47],
      [0.015, 0, -0.455],
    ],
    0.012,
    back
  );
  return [
    ...hullOf(
      orca
        ? [
            [0, 0, 0],
            [0.05, 0.06, 0.06],
            [0.2, 0.1, 0.11],
            [0.45, 0.09, 0.1],
            [0.72, 0.045, 0.05],
            [0.9, 0, 0],
          ]
        : [
            [0, 0, 0],
            [0.04, 0.015, 0.015],
            [0.1, 0.05, 0.055],
            [0.3, 0.08, 0.085],
            [0.6, 0.05, 0.055],
            [0.86, 0.018, 0.02],
            [0.9, 0, 0],
          ],
      paint
    ),
    ...slab(
      orca
        ? [
            [0, 0.09, 0.08],
            [0, 0.32, -0.02],
            [0, 0.08, -0.06],
          ]
        : [
            [0, 0.07, 0.06],
            [0, 0.17, -0.06],
            [0, 0.07, -0.08],
          ],
      0.012,
      back
    ),
    ...flipper,
    ...mirrored(flipper),
    ...patch,
    ...mirrored(patch),
    ...fluke,
    ...mirrored(fluke),
  ];
}

/**
 * How a big swimmer's body beats (ADR 0047, D48): a shark sways side to side
 * in nearly one wavelength, its tail swinging most; a dolphin or an orca
 * heaves up and down in under half of one, its flukes doing the work. A
 * longer body beats more slowly, about once a second for a dolphin or a reef
 * shark and twice as slowly for a 10 m whale shark.
 */
function swimOf(kind: Swimmer): Rig {
  const length = LOOKS[kind].length;
  const toothed = kind === "dolphin" || kind === "orca";
  return {
    mode: toothed ? "heave" : "sway",
    phase: 0,
    pivot: 0,
    rate: (2 * Math.PI * (toothed ? 1.6 : 1.4)) / Math.sqrt(length),
    reach: toothed ? 0.06 : 0.08,
    waves: toothed ? 0.35 : 0.8,
  };
}

/**
 * A big swimmer at its real length (ADR 0047, D24), in blocks, centered on
 * the origin and facing +z, so it swims at the depth the world gives it,
 * beating its body as it goes (D48).
 */
export function swimmerFaces(kind: Swimmer): readonly Face[] {
  const unit = Match.value(kind).pipe(
    Match.when("dolphin", dolphinFaces),
    Match.when("orca", dolphinFaces),
    Match.orElse(sharkFaces)
  );
  return scaled(rigged(unit, swimOf(kind)), m(LOOKS[kind].length));
}

/** One fish of a school: where it swims relative to the school's middle, in blocks, and how far its turn leads or lags. */
const Place = Schema.Struct({
  at: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  lag: Schema.Finite,
});

/**
 * A school of `count` fish of one species `size` blocks long (ADR 0047, D24):
 * each fish's place in a loose ellipsoid around the school's middle, at least
 * a body length from every other fish so no two ever overlap, picked from the
 * seed so every island's schools look the same in every browser.
 */
export function schoolOf(
  count: number,
  size: number,
  seed: number
): readonly (typeof Place.Type)[] {
  const spread = size * Math.cbrt(count) * 1.4;
  const placed = Arr.reduce(
    Arr.makeBy(count * 6, (index) => index),
    Arr.empty<typeof Place.Type>(),
    (school, index) => {
      if (school.length === count) {
        return school;
      }
      const at: Vec = [
        (unitOf(seed, index, 1) * 2 - 1) * spread,
        (unitOf(seed, index, 2) * 2 - 1) * spread * 0.4,
        (unitOf(seed, index, 3) * 2 - 1) * spread * 1.3,
      ];
      const clear = Arr.every(
        school,
        (other) =>
          Math.hypot(
            at[0] - other.at[0],
            at[1] - other.at[1],
            at[2] - other.at[2]
          ) >= size
      );
      return clear
        ? Arr.append(school, { at, lag: unitOf(seed, index, 4) })
        : school;
    }
  );
  return placed;
}
