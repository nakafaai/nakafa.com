import { Array as Arr, Match, Schema } from "effect";
import {
  type Face,
  meters as m,
  mirrored,
  type Rgb,
  rgb,
  type Vec,
} from "@/lib/island/models/parts";
import { type Ring, scaled, slab, tube } from "@/lib/island/models/solids";
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

/** A shark (ADR 0047, D24): a torpedo with a tall back fin, side fins swept back, a tall forked tail, and the hammerhead's wide head. */
function sharkFaces(
  kind: Exclude<Swimmer, "dolphin" | "orca">
): readonly Face[] {
  const look = LOOKS[kind];
  const [back, belly, mark] = [rgb(look.back), rgb(look.belly), rgb(look.mark)];
  const whale = kind === "whale-shark";
  const paint = (along: number, up: number) => {
    if (up < -0.3) {
      return belly;
    }
    const spotted =
      (whale && up > 0 && Math.floor(along * 23 + up * 5) % 3 === 0) ||
      (kind === "tiger-shark" && Math.floor(along * 10) % 3 === 1);
    return spotted ? mark : back;
  };
  const side = slab(
    [
      [0.05, -0.04, 0.22],
      [0.26, -0.09, 0.06],
      [0.06, -0.05, 0.12],
    ],
    0.008,
    back
  );
  return [
    ...hullOf(
      [
        [0, 0, 0],
        [0.04, whale ? 0.07 : 0.035, 0.035],
        [0.16, 0.075, 0.08],
        [0.38, 0.08, 0.085],
        [0.62, 0.05, 0.055],
        [0.82, 0.022, 0.03],
        [0.88, 0, 0],
      ],
      paint
    ),
    ...slab(
      [
        [0, 0.07, 0.16],
        [0, 0.22, 0.02],
        [0, 0.075, -0.02],
      ],
      0.01,
      back
    ),
    ...slab(
      [
        [0, 0.02, -0.32],
        [0, 0.17, -0.5],
        [0, 0.01, -0.4],
        [0, -0.1, -0.48],
        [0, -0.01, -0.34],
      ],
      0.01,
      back
    ),
    ...side,
    ...mirrored(side),
    ...(kind === "hammerhead"
      ? slab(
          [
            [-0.14, 0.01, 0.47],
            [0.14, 0.01, 0.47],
            [0.14, 0.01, 0.42],
            [-0.14, 0.01, 0.42],
          ],
          0.025,
          back
        )
      : []),
    ...(whale
      ? []
      : slab(
          [
            [0.03, 0.015, 0.4],
            [0.034, 0.03, 0.4],
            [0.034, 0.015, 0.395],
          ],
          0.004,
          rgb(0x15_15_18)
        )),
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
  const fluke = slab(
    [
      [0, 0, -0.4],
      [0.16, 0, -0.5],
      [0.12, 0, -0.44],
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
 * A big swimmer at its real length (ADR 0047, D24), in blocks, centered on
 * the origin and facing +z, so it swims at the depth the world gives it.
 */
export function swimmerFaces(kind: Swimmer): readonly Face[] {
  const unit = Match.value(kind).pipe(
    Match.when("dolphin", dolphinFaces),
    Match.when("orca", dolphinFaces),
    Match.orElse(sharkFaces)
  );
  return scaled(unit, m(LOOKS[kind].length));
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
