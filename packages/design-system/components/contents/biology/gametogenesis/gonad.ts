import {
  globe,
  organ,
} from "@repo/design-system/components/contents/biology/gametogenesis/tissue";
import {
  fractalAt,
  ridgedAt,
} from "@repo/design-system/components/three/field/noise";
import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import { attachForm } from "@repo/design-system/components/three/organism/form";
import {
  dorsal,
  duct,
  loftBody,
  ovoid,
} from "@repo/design-system/components/three/organism/loft";
import { moundBody } from "@repo/design-system/components/three/organism/mound";
import { scatter } from "@repo/design-system/components/three/organism/scatter";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr } from "effect";
import { Color } from "three";

const PINK = new Color(BIOLOGY_COLORS.tissuePink);
const DEEP = new Color(BIOLOGY_COLORS.tissueDeep);
const PALE = new Color(BIOLOGY_COLORS.tubuleLumen);
const AMBER = new Color(BIOLOGY_COLORS.leydigAmber);
const GOLD = new Color(BIOLOGY_COLORS.luteumGold);
const IVORY = new Color(BIOLOGY_COLORS.zonaPellucida);
const FLUID = new Color(BIOLOGY_COLORS.follicleFluid);
const YOLK = new Color(BIOLOGY_COLORS.oocyteYolk);
const CORONA = new Color(BIOLOGY_COLORS.coronaCell);
const STAIN = new Color(BIOLOGY_COLORS.chromatinStain);
const NUCLEUS = new Color(BIOLOGY_COLORS.eggNucleus);
const BLOOD = new Color(BIOLOGY_COLORS.blood);
const CLOT = new Color(BIOLOGY_COLORS.bloodDark);
const HEAD = new Color(BIOLOGY_COLORS.spermHeadBlue);
const TAIL = new Color(BIOLOGY_COLORS.flagellumIvory);

/** Where the three cut seminiferous tubules of the testis section lie. */
const TUBULES = [
  [-0.38, 0.6, 0],
  [0, 0.66, 0.01],
  [0.38, 0.58, 0.02],
] as const;

/** Where the clusters of interstitial cells lie between the tubules. */
const CLUSTERS = [
  [-0.19, 0.5, 0.08],
  [0.19, 0.48, 0.08],
  [0, 0.4, 0.06],
] as const;

/** A tubule's radius to the middle of its wall, half its wall's thickness, and half the slice's depth. */
const RING = 0.15;
const WALL = 0.045;
const DEPTH = 0.07;

/** A full turn, in radians. */
const TURN = 2 * Math.PI;

/**
 * One seminiferous tubule cut across: a thick ring of germinal epithelium
 * round an open lumen, darker at its basement membrane and pale within.
 */
function tubule(detail: number): Form {
  return loftBody({
    along: faces(96, detail),
    around: faces(32, detail),
    belly: 0,
    lump: 0.04,
    paint: (along, around, color) => {
      const grain = fractalAt(along, around, 24, 6, 41, 3);
      const lumen = around > 0.6 && around < 0.9 ? 0.6 : 0;
      color
        .copy(DEEP)
        .lerp(PINK, 0.3 + 0.5 * dorsal(around))
        .lerp(PALE, lumen)
        .multiplyScalar(0.85 + 0.3 * grain);
    },
    relief: () => 0,
    seed: 43,
    square: 5,
    stations: Arr.makeBy(25, (step) => ({
      centre: [
        RING * Math.cos((step / 24) * TURN - Math.PI / 2),
        RING * Math.sin((step / 24) * TURN - Math.PI / 2),
        0,
      ],
      tall: DEPTH,
      wide: WALL,
    })),
    up: [0, 0, 1],
  });
}

/**
 * A slice of testis: three seminiferous tubules cut across, bedded in the
 * loose connective tissue between them, with a capillary winding through it.
 */
export function testisForms(detail: number): readonly Form[] {
  const ring = tubule(detail);
  return [
    organ(
      {
        along: 48,
        around: 48,
        deep: PINK,
        lobes: 0,
        lump: 0.1,
        pale: PALE,
        seed: 47,
        stations: ovoid([0, 0.6, -0.05], 1.36, 0.34, 0.06, 0),
      },
      detail
    ),
    ...Arr.map(TUBULES, (centre) =>
      attachForm(ring, centre, [1, 0, 0], [0, 1, 0])
    ),
    organ(
      {
        along: 64,
        around: 10,
        deep: CLOT,
        lobes: 0,
        lump: 0.1,
        pale: BLOOD,
        seed: 49,
        stations: duct([
          [-0.2, 0.3, 0.02, 0.008],
          [-0.2, 0.44, 0.04, 0.012],
          [-0.06, 0.45, 0.04, 0.011],
          [0.09, 0.44, 0.04, 0.012],
          [0.19, 0.56, 0.04, 0.011],
          [0.2, 0.82, 0.02, 0.008],
        ]),
      },
      detail
    ),
  ];
}

/**
 * One cell seen in a cut face, a unit across: a low dome of cytoplasm with
 * its stained nucleus at the middle. A germ cell in a tubule's wall, or a
 * primordial follicle in the ovary's cortex.
 */
export function cellForms(detail: number): readonly Form[] {
  return [
    moundBody({
      height: (out) => 0.3 * (1 - out * out) ** 0.6,
      paint: (out, turn, color) => {
        if (out < 0.45) {
          color
            .copy(STAIN)
            .multiplyScalar(0.8 + 0.5 * fractalAt(turn, out, 6, 3, 53, 2));
          return;
        }
        color.copy(PALE).lerp(PINK, out ** 3);
      },
      rim: () => 0.5,
      rings: faces(10, detail),
      spokes: faces(16, detail),
    }),
  ];
}

/**
 * The seats of the germ cells in one tubule's wall, from its basement
 * membrane inwards: spermatogonia, the larger spermatocytes, and the small
 * spermatids next to the lumen.
 */
const SEATS = Arr.flatMap(
  [
    { at: 0.18, count: 14, size: 0.04 },
    { at: 0.149, count: 11, size: 0.046 },
    { at: 0.119, count: 9, size: 0.028 },
  ],
  (layer, row) =>
    Arr.makeBy(layer.count, (seat) => ({
      at: layer.at,
      size: layer.size,
      turn: ((seat + 0.5 * row) / layer.count) * TURN,
    }))
);

/** The germ cells that line the cut face of every tubule, layer by layer. */
export function germCells() {
  return scatter(TUBULES.length * SEATS.length, 59, (index, chance) => {
    const centre = Arr.getUnsafe(TUBULES, Math.floor(index / SEATS.length));
    const seat = Arr.getUnsafe(SEATS, index % SEATS.length);
    const turn = seat.turn + 0.12 * (chance(1) - 0.5);
    const size = seat.size * (0.85 + 0.3 * chance(2));
    return {
      lean: [Math.PI / 2, 0, 0],
      place: [
        centre[0] + seat.at * Math.cos(turn),
        centre[1] + seat.at * Math.sin(turn),
        centre[2] + DEPTH - 0.004,
      ],
      size: [size, size, size],
    };
  });
}

/** One sperm cell forming at the lumen, a unit long along x: its dense head, then its tail. */
export function tailForms(detail: number): readonly Form[] {
  return [
    loftBody({
      along: faces(20, detail),
      around: 8,
      belly: 0,
      lump: 0,
      paint: (along, _around, color) => {
        color.copy(along < 0.22 ? HEAD : TAIL);
      },
      relief: () => 0,
      seed: 61,
      square: 2,
      stations: duct([
        [0, 0, 0, 0],
        [0.06, 0, 0, 0.07],
        [0.18, 0, 0, 0.05],
        [0.24, 0.01, 0, 0.018],
        [0.5, 0.06, 0, 0.016],
        [0.8, -0.04, 0, 0.012],
        [1, 0, 0, 0],
      ]),
      up: [0, 0, 1],
    }),
  ];
}

/** The young sperm of every tubule: heads held in the wall, tails trailing into the lumen. */
export function spermTails() {
  return scatter(TUBULES.length * 18, 63, (index, chance) => {
    const centre = Arr.getUnsafe(TUBULES, Math.floor(index / 18));
    const turn = ((index % 18) / 18) * TURN + 0.3 * chance(1);
    const long = 0.06 + 0.03 * chance(2);
    return {
      lean: [0, 0, turn + Math.PI + 0.5 * (chance(4) - 0.5)],
      place: [
        centre[0] + 0.1 * Math.cos(turn),
        centre[1] + 0.1 * Math.sin(turn),
        centre[2] + 0.01 + 0.05 * chance(3),
      ],
      size: [long, long, long],
    };
  });
}

/** One interstitial cell, a unit across: a plump, uneven cell packed with lipid. */
export function leydigForms(detail: number): readonly Form[] {
  return [globe([0, 0, 0], 0.5, 0.22, AMBER, GOLD, detail)];
}

/** The interstitial cells, clustered in the tissue between the tubules. */
export function leydigCells() {
  return scatter(CLUSTERS.length * 8, 67, (index, chance) => {
    const cluster = Arr.getUnsafe(CLUSTERS, index % CLUSTERS.length);
    const reach = 0.06 * Math.sqrt(chance(1));
    const bearing = chance(2) * TURN;
    const size = 0.038 + 0.02 * chance(3);
    return {
      lean: [chance(4) * TURN, chance(5) * TURN, 0],
      place: [
        cluster[0] + reach * Math.cos(bearing),
        cluster[1] + reach * Math.sin(bearing),
        cluster[2] - 0.04 + 0.02 * chance(6),
      ],
      size: [size, size, size],
    };
  });
}

/** How far a place on a mound lies from a point of its floor. */
function away(reach: number, turn: number, point: readonly [number, number]) {
  return Math.hypot(
    reach * Math.cos(turn * TURN) - point[0],
    reach * Math.sin(turn * TURN) - point[1]
  );
}

/** Where the oocyte sits on its hillock inside the ripe follicle, on the follicle's own floor. */
const HILLOCK = [-0.07, -0.04] as const;
const FOLLICLE = 0.17;

/**
 * A ripe follicle cut open: a wall of granulosa cells round a pool of
 * follicular fluid, and the oocyte on its hillock, wrapped in its own cells.
 */
function follicle(detail: number): Form {
  return moundBody({
    height: (out, turn) => {
      const egg = away(out * FOLLICLE, turn, HILLOCK) / 0.052;
      return (
        0.07 * (1 - out * out) ** 0.5 +
        0.034 * Math.max(0, 1 - egg * egg) ** 0.5
      );
    },
    paint: (out, turn, color) => {
      const egg = away(out * FOLLICLE, turn, HILLOCK);
      const grain = fractalAt(turn, out, 40, 8, 71, 2);
      if (egg < 0.014) {
        color.copy(NUCLEUS);
      } else if (egg < 0.036) {
        color.copy(YOLK).multiplyScalar(0.9 + 0.2 * grain);
      } else if (egg < 0.052) {
        color.copy(CORONA).multiplyScalar(0.75 + 0.4 * grain);
      } else if (out > 0.84) {
        color
          .copy(PINK)
          .lerp(AMBER, 0.45)
          .multiplyScalar(0.75 + 0.45 * grain);
      } else {
        color.copy(FLUID).multiplyScalar(0.92 + 0.1 * grain);
      }
    },
    rim: () => FOLLICLE,
    rings: faces(48, detail),
    spokes: faces(72, detail),
  });
}

/**
 * A corpus luteum cut across: the collapsed follicle's wall thrown into
 * deep golden folds round the pale remains of its clot.
 */
function luteum(detail: number): Form {
  const fold = (out: number, turn: number) =>
    Math.sin(out * 15 + 11 * fractalAt(turn, out * 0.5, 7, 2, 77, 3));
  return moundBody({
    height: (out, turn) =>
      0.062 * (1 - out * out) ** 0.5 * (1 + 0.22 * fold(out, turn)),
    paint: (out, turn, color) => {
      if (out < 0.2) {
        color.copy(PALE).lerp(PINK, out * 3);
        return;
      }
      color
        .copy(GOLD)
        .multiplyScalar(
          0.68 +
            0.2 * fold(out, turn) +
            0.25 * fractalAt(turn, out, 30, 8, 73, 2)
        );
    },
    rim: (turn) => 0.16 * (0.94 + 0.12 * fractalAt(turn, 0.5, 9, 1, 75, 2)),
    rings: faces(48, detail),
    spokes: faces(84, detail),
  });
}

/**
 * An ovary cut in half: a pale cortex round a medulla threaded with blood
 * vessels under a tough white coat, with a ripe follicle and a corpus
 * luteum in its cut face.
 */
export function ovaryForms(detail: number): readonly Form[] {
  const half = loftBody({
    along: faces(72, detail),
    around: faces(120, detail),
    belly: 1,
    lump: 0.05,
    paint: (along, around, color) => {
      const grain = fractalAt(along, around, 9, 14, 79, 3);
      if (around < 0.25 || around > 0.75) {
        color.copy(PINK).lerp(IVORY, 0.4 + 0.45 * grain);
        return;
      }
      const edge = Math.max(
        Math.abs(Math.sin(around * TURN)),
        Math.abs(2 * along - 1) ** 2
      );
      const vessels = Math.max(0, ridgedAt(along, around, 6, 10, 83, 3) - 0.62);
      color
        .copy(PINK)
        .lerp(DEEP, Math.min(1, vessels * 5) * (edge < 0.7 ? 1 : 0.2))
        .lerp(PALE, edge > 0.62 ? 0.55 : 0.15)
        .lerp(IVORY, edge > 0.95 ? 0.8 : 0)
        .multiplyScalar(0.86 + 0.28 * grain);
    },
    relief: () => 0,
    seed: 87,
    square: 2.3,
    stations: ovoid([0, 0.58, 0], 1.16, 0.4, 0.24, 0.12),
    up: [0, 0, -1],
  });
  return [
    half,
    attachForm(follicle(detail), [-0.24, 0.6, 0], [1, 0, 0], [0, 0, 1]),
    attachForm(luteum(detail), [0.24, 0.58, 0], [1, 0, 0], [0, 0, 1]),
  ];
}

/** The primordial and growing follicles scattered through the ovary's cortex. */
export function follicles() {
  return scatter(44, 89, (index, chance) => {
    const bearing = (index / 44) * TURN + 0.1 * chance(1);
    const reach = 0.72 + 0.14 * chance(2);
    const size = 0.03 + 0.04 * chance(3) ** 2;
    return {
      lean: [Math.PI / 2, 0, 0],
      place: [
        0.56 * reach * Math.cos(bearing),
        0.58 + 0.39 * reach * Math.sin(bearing),
        0,
      ],
      size: [size, size, size],
    };
  });
}
