import type { Point } from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  arch,
  FRONT,
  facePoint,
  gapMiddle,
  LANES,
} from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import { SYNTHASES } from "@repo/design-system/components/contents/biology/mitochondrion/particles";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Match, Option, Schema } from "effect";

/**
 * What one glucose molecule gives a cell, and where each step happens: in
 * aerobic respiration with oxygen, and in the two fermentations without it.
 * Sources: OpenStax Biology 2e, sections 7.2 to 7.5; the KSSM Form 4
 * Biology textbook (Malaysia, DSKP 7.1 to 7.3), chapter 7.
 */

/** Whether the cell has oxygen, and which cell it is when it has none. */
export const CellSchema = Schema.Literals(["muscle", "yeast"]);
export type Cell = typeof CellSchema.Type;

/** The three ways a cell can release energy from glucose. */
const ConditionSchema = Schema.Literals(["aerobic", "lactic", "alcoholic"]);
export type Condition = typeof ConditionSchema.Type;

/**
 * How a cell respires: aerobically whenever oxygen is there; without it a
 * muscle cell makes lactic acid and a yeast cell ethanol and carbon dioxide.
 */
export function conditionOf(oxygen: boolean, cell: Cell): Condition {
  if (oxygen) {
    return "aerobic";
  }
  return cell === "muscle" ? "lactic" : "alcoholic";
}

/**
 * Glycolysis splits glucose into two pyruvate in the cytoplasm and makes a
 * net 2 ATP, with or without oxygen (OpenStax Biology 2e, 7.2).
 */
export const GLYCOLYSIS_ATP = 2;

/**
 * What one glucose gives in each condition. Aerobic: C6H12O6 + 6 O2 →
 * 6 CO2 + 6 H2O, so 6 oxygen used and 6 carbon dioxide and 6 water made, and
 * 12 pairs of hydrogen carried to the cristae: 10 NADH and 2 FADH2 (OpenStax
 * Biology 2e, 7.3 and 7.4). Lactic acid fermentation: glucose → 2 lactic
 * acid; alcoholic: glucose → 2 ethanol + 2 CO2; in both the 2 NADH of
 * glycolysis hand their hydrogen back to pyruvate (OpenStax 7.5). Energy
 * released per mole of glucose, as the KSSM Form 4 Biology textbook gives
 * it: 2898 kJ aerobic, 150 kJ lactic and 210 kJ alcoholic.
 */
const YIELDS = {
  aerobic: {
    carbonDioxide: 6,
    carriers: 12,
    energy: 2898,
    oxygen: 6,
    water: 6,
  },
  alcoholic: {
    carbonDioxide: 2,
    carriers: 2,
    energy: 210,
    oxygen: 0,
    water: 0,
  },
  lactic: { carbonDioxide: 0, carriers: 2, energy: 150, oxygen: 0, water: 0 },
} as const;

/** What one glucose gives in `condition`: carbon dioxide, water, oxygen used, hydrogen carriers and energy in kJ. */
export function yieldOf(condition: Condition) {
  return YIELDS[condition];
}

/**
 * The ATP one glucose makes: the lesson's own aerobic total `aerobic`, since
 * textbooks differ (about 30 to 32 in OpenStax, 36 or 38 in many school
 * syllabi), and the 2 of glycolysis alone when there is no oxygen.
 */
export function atpMade(condition: Condition, aerobic: number) {
  return condition === "aerobic" ? aerobic : GLYCOLYSIS_ATP;
}

/** The ATP made at the inner membrane: all but the 2 of glycolysis, none without oxygen. */
export function atpAtMembrane(condition: Condition, aerobic: number) {
  return atpMade(condition, aerobic) - GLYCOLYSIS_ATP;
}

/** Where oxygen is used: at the inner membrane, by the last complex of the chain on the cristae, or nowhere. */
export function oxygenSite(condition: Condition) {
  return condition === "aerobic"
    ? Option.some("inner" as const)
    : Option.none();
}

/** The molecules the scene moves, each drawn as its space-filling model. */
export const MoleculeSchema = Schema.Literals([
  "glucose",
  "pyruvate",
  "lactate",
  "ethanol",
  "carbonDioxide",
  "oxygen",
  "water",
  "carrier",
  "atp",
]);
export type Molecule = typeof MoleculeSchema.Type;

/**
 * One molecule's trip in one glucose's journey: it shows from `start` to
 * `end` of the cycle, as shares of it, and moves through `path`.
 */
const TripSchema = Schema.Struct({
  end: Schema.Finite,
  journey: Schema.Int,
  molecule: MoleculeSchema,
  path: Schema.Array(
    Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite])
  ),
  spin: Schema.Finite,
  start: Schema.Finite,
});
export type Trip = typeof TripSchema.Type;

/** How many glucose journeys run at once, a third of a cycle apart, so a still frame shows every stage. */
export const JOURNEYS = 3;

/** How long one journey takes while the card plays, in seconds. */
export const CYCLE = 15;

/**
 * The moment of the cycle a paused card shows. Its three journeys then stand
 * at a tenth, at 0.43 and at 0.77 of their own cycles: glucose arriving,
 * pyruvate in the matrix giving off carbon dioxide and hydrogen as oxygen
 * comes in, and water and ATP leaving.
 */
export const STILL = 0.1;

/** Where glycolysis splits each glucose: in the cytoplasm above the organelle's left half. */
export const GLYCOLYSIS: Point = [-0.8, 0.98, FRONT];

/** A point offset from `point` in the plane of the molecules. */
function shift(point: Point, x: number, y: number): Point {
  return [point[0] + x, point[1] + y, point[2]];
}

/**
 * The path across both membranes at matrix gap `gap`, `spread` off its
 * middle, outward from inside the matrix through the top edge of the cut:
 * in the matrix, in the membranes, and out in the cytoplasm. The cytoplasm above is the side the
 * reader sees, so every molecule crosses there and the side below stays
 * clear for the labels.
 */
function crossing(gap: number, spread = 0): readonly Point[] {
  return Arr.map([0.16, 0.37, 0.6] as const, (height): Point => {
    const y = arch(0) + height;
    return [gapMiddle(gap, y, 0) + spread, y, FRONT];
  });
}

/** Where a molecule that left at gap `gap` drifts to in the cytoplasm, `salt` scattering it. */
function drift(gap: number, salt: number): Point {
  const [, , outer] = crossing(gap);
  return [
    outer[0] + (hashUnit(salt, 5) - 0.5) * 0.5,
    outer[1] + 0.2 + 0.35 * hashUnit(salt, 6),
    FRONT + (hashUnit(salt, 7) - 0.5) * 0.06,
  ];
}

/** One trip. */
function trip(
  molecule: Molecule,
  journey: number,
  start: number,
  end: number,
  path: readonly Point[]
): Trip {
  return {
    end,
    journey,
    molecule,
    path,
    spin: hashUnit(journey * 97 + start * 1000, end * 1000),
    start,
  };
}

/** The trips of glycolysis, common to every condition: glucose in, split, 2 ATP out. */
function glycolysis(journey: number) {
  const entry: Point = [-1.62, 1.52 - journey * 0.05, FRONT];
  return [
    trip("glucose", journey, 0, 0.16, [
      entry,
      shift(GLYCOLYSIS, -0.3, 0.18),
      GLYCOLYSIS,
    ]),
    ...Arr.map([-1, 1] as const, (sign) =>
      trip("atp", journey, 0.16, 0.55, [
        GLYCOLYSIS,
        shift(GLYCOLYSIS, -0.22, 0.1 + 0.08 * sign),
        shift(GLYCOLYSIS, -0.5, 0.05 + 0.25 * sign),
      ])
    ),
  ];
}

/** Where each pyruvate is turned into its product without oxygen, in the cytoplasm. */
function fermentSpot(sign: number, journey: number): Point {
  return shift(
    GLYCOLYSIS,
    -0.25 + sign * 0.22 - 0.04 * journey,
    -0.3 + 0.04 * journey
  );
}

/** The trips without oxygen: pyruvate and its hydrogen meet in the cytoplasm and leave as lactic acid, or as ethanol and carbon dioxide. */
function fermentation(condition: "lactic" | "alcoholic", journey: number) {
  return Arr.flatMap([-1, 1] as const, (sign) => {
    const spot = fermentSpot(sign, journey);
    const away = shift(spot, -0.35 + 0.1 * sign, 0.4);
    const meet = [
      trip("pyruvate", journey, 0.16, 0.44, [
        GLYCOLYSIS,
        shift(GLYCOLYSIS, sign * 0.12, -0.12),
        spot,
      ]),
      trip("carrier", journey, 0.16, 0.4, [
        GLYCOLYSIS,
        shift(GLYCOLYSIS, sign * 0.05, 0.08),
        shift(spot, 0.03, 0.08),
      ]),
    ];
    const products = Match.value(condition).pipe(
      Match.when("lactic", () => [
        trip("lactate", journey, 0.4, 0.95, [spot, away]),
      ]),
      Match.when("alcoholic", () => [
        trip("ethanol", journey, 0.4, 0.95, [spot, away]),
        trip("carbonDioxide", journey, 0.4, 0.85, [
          spot,
          shift(spot, 0.15 * sign, 0.45),
        ]),
      ]),
      Match.exhaustive
    );
    return Arr.appendAll(meet, products);
  });
}

/** The three points of gap `gap` where hydrogen and oxygen meet, beside the cut faces of its cristae. */
function meetings(gap: number) {
  return Arr.map([0.2, 0.04, -0.12] as const, (height, index) =>
    facePoint(gap, index === 1 ? "right" : "left", height, 0.05)
  );
}

/**
 * The ATP synthases ATP leaves from: every one near the top edge of the
 * cut, leaning into a gap the molecules cross by, so the ATP streams out all
 * along the organelle.
 */
const SOURCES = Arr.filter(
  SYNTHASES,
  (synthase) =>
    synthase.head[1] > arch(synthase.head[0]) + 0.1 &&
    synthase.head[2] > -0.14 &&
    synthase.crista + (synthase.side === 1 ? 0 : -1) >= 1 &&
    synthase.crista + (synthase.side === 1 ? 0 : -1) <= 5
);

/** The trips with oxygen for one journey: pyruvate in, carbon dioxide out, hydrogen and oxygen to water, and ATP out. */
function aerobic(journey: number, membraneAtp: number) {
  const gaps = Arr.getUnsafe(LANES, journey);
  const inside = Arr.flatMap(gaps, (gap, which) => {
    const [inner, middle, outer] = crossing(gap);
    const centre: Point = [
      gapMiddle(gap, arch(0) + 0.05, 0),
      arch(0) + 0.05,
      FRONT,
    ];
    const meet = meetings(gap);
    const pyruvate = trip("pyruvate", journey, 0.16, 0.46, [
      GLYCOLYSIS,
      shift(GLYCOLYSIS, (which - 0.5) * 0.3, -0.08),
      shift(outer, 0, 0.12),
      outer,
      middle,
      inner,
      centre,
    ]);
    const carriers = Arr.flatMap(meet, (point, index) =>
      Arr.map([0, 1] as const, (pair) =>
        trip("carrier", journey, 0.42 + 0.02 * index, 0.66, [
          shift(centre, 0, 0.03 * pair),
          shift(point, 0, 0.035 * (pair * 2 - 1)),
        ])
      )
    );
    const oxygen = Arr.map(meet, (point, index) =>
      trip("oxygen", journey, 0.38 + 0.03 * index, 0.66, [
        drift(gap, journey * 13 + which * 5 + index),
        outer,
        middle,
        point,
      ])
    );
    const water = Arr.map(meet, (point, index) =>
      trip("water", journey, 0.66, 0.94, [
        point,
        middle,
        outer,
        drift(gap, journey * 17 + which * 7 + index + 50),
      ])
    );
    const carbonDioxide = Arr.map(Arr.range(0, 2), (index) =>
      trip("carbonDioxide", journey, 0.42 + 0.05 * index, 0.78, [
        shift(centre, 0.02 * (index - 1), -0.04 * index),
        inner,
        middle,
        outer,
        drift(gap, journey * 19 + which * 3 + index + 90),
      ])
    );
    return [pyruvate, ...carriers, ...oxygen, ...water, ...carbonDioxide];
  });
  const atp = Arr.map(Arr.range(0, membraneAtp - 1), (index) => {
    const synthase = Arr.getUnsafe(
      SOURCES,
      (index * 7 + journey * 11) % SOURCES.length
    );
    const gap = synthase.side === 1 ? synthase.crista : synthase.crista - 1;
    const spread = (hashUnit(index, 17 + journey) - 0.5) * 0.08;
    const [inner, middle, outer] = crossing(gap, spread);
    const start = 0.54 + (0.3 * index) / Math.max(1, membraneAtp - 1);
    return trip("atp", journey, start, start + 0.15, [
      synthase.head,
      [
        gapMiddle(gap, synthase.head[1], 0) + spread,
        synthase.head[1] - 0.04,
        FRONT,
      ],
      inner,
      middle,
      outer,
      drift(gap, journey * 23 + index + 130),
    ]);
  });
  return Arr.appendAll(inside, atp);
}

/**
 * Every molecule's trip for `condition`, over all journeys, when the
 * aerobic total is `atp` ATP per glucose.
 */
export function tripsOf(condition: Condition, atp: number): readonly Trip[] {
  return Arr.flatMap(Arr.range(0, JOURNEYS - 1), (journey) => [
    ...glycolysis(journey),
    ...Match.value(condition).pipe(
      Match.when("aerobic", () =>
        aerobic(journey, atpAtMembrane(condition, atp))
      ),
      Match.when("lactic", () => fermentation("lactic", journey)),
      Match.when("alcoholic", () => fermentation("alcoholic", journey)),
      Match.exhaustive
    ),
  ]);
}

/**
 * How far along its path a trip is at `phase` of the cycle, from 0 to 1, or
 * none while it is not showing. Each journey runs a third of a cycle ahead of
 * the last.
 */
export function progress(trip: Trip, phase: number) {
  const local = (((phase + trip.journey / JOURNEYS) % 1) + 1) % 1;
  if (local < trip.start || local > trip.end) {
    return Option.none();
  }
  return Option.some((local - trip.start) / (trip.end - trip.start));
}

/** How large a molecule shows at `share` of its trip: it forms and goes over the first and last tenth. */
export function presence(share: number) {
  return Math.min(1, share / 0.1, (1 - share) / 0.1);
}

/** Eases a trip's motion: it sets off gently and settles where it arrives. */
export function ease(share: number) {
  return share * share * (3 - 2 * share);
}
