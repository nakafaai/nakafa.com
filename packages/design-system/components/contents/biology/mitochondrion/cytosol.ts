import type { Point } from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  arch,
  BODY,
  INSET,
  MEMBRANE,
  sectionRadius,
} from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import type { Cell } from "@repo/design-system/components/contents/biology/mitochondrion/respiration";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Match, Schema } from "effect";

/**
 * The cytoplasm around the organelle, which differs by cell: a muscle cell's
 * mitochondrion lies beside a striated myofibril, among granules of
 * glycogen; a yeast cell is small enough that its envelope, a thick wall
 * outside the plasma membrane, crosses the view where glucose comes in.
 */

/** The stretch of cytosol the scene shows around the organelle, in micrometres. */
export const CYTOSOL = {
  x: [-2.3, 1.75],
  y: [-1.05, 1.55],
  z: [-0.85, -0.22],
} as const;

/** Whether `point` lies clear of the organelle's outer face by `clearance`. */
export function outsideBody([x, y, z]: Point, clearance: number) {
  const radial = Math.hypot(y - arch(x), z);
  return (
    Math.abs(x) - BODY.length / 2 > clearance ||
    radial > sectionRadius(x, INSET.outer) * 1.04 + clearance
  );
}

/** A seeded point in the stretch of cytosol, `salt` choosing the scatter. */
function cytosolSpot(index: number, salt: number): Point {
  const [x0, x1] = CYTOSOL.x;
  const [y0, y1] = CYTOSOL.y;
  const [z0, z1] = CYTOSOL.z;
  return [
    x0 + (x1 - x0) * hashUnit(index, salt),
    y0 + (y1 - y0) * hashUnit(index, salt + 1),
    z0 + (z1 - z0) * hashUnit(index, salt + 2),
  ];
}

/** How many ribosomes each polysome strings along its messenger RNA. */
export const POLYSOME = 5;

/**
 * Ribosomes in the cytosol behind the molecules that cross it, strung as
 * polysomes, short chains of ribosomes reading one messenger RNA, as
 * micrographs show them.
 */
export const CYTOSOL_RIBOSOMES = Arr.flatMap(
  Arr.filter(
    Arr.map(Arr.range(0, 43), (index) => cytosolSpot(index, 91)),
    (centre) => outsideBody(centre, 0.12)
  ),
  (centre: Point, index) => {
    const heading = hashUnit(index, 94) * Math.PI * 2;
    return Arr.map(Arr.range(0, POLYSOME - 1), (step): Point => {
      const along = (step - POLYSOME / 2) * 0.03;
      const sway = 0.012 * Math.sin(step * 1.9 + index);
      return [
        centre[0] + along * Math.cos(heading) - sway * Math.sin(heading),
        centre[1] + along * Math.sin(heading) + sway * Math.cos(heading),
        centre[2] + 0.01 * Math.cos(step * 2.3 + index),
      ];
    });
  }
);

/**
 * Glycogen granules, the β-particles of a muscle cell's glucose store,
 * about 25 nm across (Prats et al., J. Biol. Chem. 293, 2018).
 */
export const GLYCOGEN_RADIUS = 0.0125;
export const GLYCOGEN = Arr.filter(
  Arr.map(Arr.range(0, 89), (index) => cytosolSpot(index, 31)),
  (spot) => outsideBody(spot, 0.06)
);

/**
 * A myofibril of the muscle cell, running behind the organelle as
 * intermyofibrillar mitochondria lie alongside them: about 1 µm across
 * (Alberts, ch. 16), striated by sarcomeres 2.2 µm long at rest, each an
 * A band of thick filaments 1.6 µm long with its paler H zone and M line in
 * the middle, between the I bands and Z discs (OpenStax Anatomy and
 * Physiology 2e, 10.2).
 */
export const MYOFIBRIL = {
  axis: [0, -1.02, -1.35],
  bandA: 1.6,
  hZone: 0.3,
  length: 8.8,
  line: 0.05,
  offset: 0.35,
  radius: 0.48,
  sarcomere: 2.2,
} as const;

/** The bands of a sarcomere: Z disc, I band, A band, its H zone and M line. */
const BandSchema = Schema.Literals(["z", "i", "a", "h", "m"]);
type Band = typeof BandSchema.Type;

/** Which band of its sarcomere lies at `x` along the myofibril. */
export function bandAt(x: number): Band {
  const along =
    (((x - MYOFIBRIL.offset) % MYOFIBRIL.sarcomere) + MYOFIBRIL.sarcomere) %
    MYOFIBRIL.sarcomere;
  const fromMiddle = Math.abs(along - MYOFIBRIL.sarcomere / 2);
  const fromZ = Math.min(along, MYOFIBRIL.sarcomere - along);
  if (fromZ < MYOFIBRIL.line / 2) {
    return "z";
  }
  if (fromMiddle < MYOFIBRIL.line / 2) {
    return "m";
  }
  if (fromMiddle < MYOFIBRIL.hZone / 2) {
    return "h";
  }
  return fromMiddle < MYOFIBRIL.bandA / 2 ? "a" : "i";
}

/**
 * The yeast cell's envelope where it crosses the view, as an arc round
 * `centre` in the plane of the cut, running from the plasma membrane at
 * `radius` outward through the cell wall, 100 to 200 nm thick (Klis et al.,
 * Yeast 23, 2006): an inner layer of glucan and chitin and an outer layer of
 * mannoproteins, whose fibrils stand out from it. A diploid baker's yeast
 * cell is about 5 to 6 µm across (Sherman, Methods in Enzymology 350, 2002),
 * so the arc curves gently.
 */
export const ENVELOPE = {
  centre: [0.62, -1.2],
  depth: 1.2,
  from: (100 * Math.PI) / 180,
  glucan: 0.08,
  mannan: 0.06,
  membrane: MEMBRANE,
  radius: 3.3,
  to: (172 * Math.PI) / 180,
} as const;

/** How far `point` lies from the envelope's centre in the plane of the cut. */
function envelopeDistance([x, y]: Point) {
  const [cx, cy] = ENVELOPE.centre;
  return Math.hypot(x - cx, y - cy);
}

/** Whether `point` lies inside the yeast cell, `clearance` within its plasma membrane. */
export function insideCell(point: Point, clearance: number) {
  return envelopeDistance(point) < ENVELOPE.radius - clearance;
}

/** Where a molecule or a body stands for each cell: everywhere in a muscle cell, inside the envelope in a yeast cell. */
export function keptIn(cell: Cell, point: Point, clearance: number) {
  return Match.value(cell).pipe(
    Match.when("muscle", () => true),
    Match.when("yeast", () => insideCell(point, clearance)),
    Match.exhaustive
  );
}
