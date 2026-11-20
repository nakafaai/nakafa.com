import type {
  Crista,
  Point,
} from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  arch,
  attachment,
  CRISTAE,
  cristaPoint,
  cristaReach,
  EMPHASIS,
  GAP_COUNT,
  gapClearance,
  gapPoint,
  QUIET_GAPS,
} from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr } from "effect";

/**
 * The proteins on the cristae and the bodies in the matrix, placed by
 * seeded scatter so every visit draws the same organelle. Proteins that
 * stand in a membrane are drawn at the membranes' `EMPHASIS`; the bodies free
 * in the matrix and the cytosol keep their real size.
 */

/**
 * An ATP synthase: its F1 head, about 10 nm across (Strauss et al., EMBO J.
 * 27, 2008), on a stalk about as long that holds it out into the matrix.
 * Dimers stand in rows along the tightly curved rims of the cristae (Davies
 * et al., PNAS 108, 2011), their two heads splayed 40 to 70 degrees apart
 * (Mannella, Ann. N. Y. Acad. Sci. 1147, 2008), so each leans about 27
 * degrees off the rim.
 */
export const SYNTHASE = {
  head: 0.005 * EMPHASIS,
  lean: (27 * Math.PI) / 180,
  spacing: 0.042,
  stalk: 0.006 * EMPHASIS,
} as const;

/** The ATP synthases along one crista's free rim, leaning to either face in turn, clear of its junctions and of the cut. */
function synthasesOf(crista: Crista, index: number) {
  const reach = cristaReach(crista, (3 * Math.PI) / 2);
  const count = Math.floor((Math.PI * reach) / SYNTHASE.spacing);
  const lift = SYNTHASE.stalk + SYNTHASE.head;
  const all = Arr.map(Arr.range(0, count - 1), (step) => {
    const theta = Math.PI + ((step + 0.5) / count) * Math.PI;
    const foot = cristaPoint(crista, theta, 1, 0);
    const side = step % 2 === 0 ? 1 : -1;
    const up: Point = [
      side * Math.sin(SYNTHASE.lean),
      Math.cos(theta) * Math.cos(SYNTHASE.lean),
      Math.sin(theta) * Math.cos(SYNTHASE.lean),
    ];
    const head: Point = [
      foot[0] + up[0] * lift,
      foot[1] + up[1] * lift,
      foot[2] + up[2] * lift,
    ];
    return { crista: index, foot, head, side, theta, up };
  });
  return Arr.filter(
    all,
    (synthase) =>
      synthase.head[2] < -1.5 * SYNTHASE.head &&
      attachment(crista, synthase.theta) < 0.01
  );
}

/** Every ATP synthase on every crista. */
export const SYNTHASES = Arr.flatMap(CRISTAE, synthasesOf);

/**
 * The respiratory chain complexes that stud the flat faces of the cristae
 * (Davies et al. 2011), where hydrogen is handed on and oxygen takes it up:
 * low mounds about 20 nm across standing about 10 nm into the matrix,
 * drawn at `EMPHASIS`.
 */
export const COMPLEX = { lift: 0.006 * EMPHASIS, width: 0.009 * EMPHASIS };

/** How many complexes each face of a crista carries. */
const COMPLEXES_PER_FACE = 6;

/** The respiratory chain complexes on both faces of every crista: where each stands and which way its face looks. */
export const COMPLEXES = Arr.flatMap(CRISTAE, (crista, index) =>
  Arr.flatMap([-1, 1] as const, (face) =>
    Arr.map(Arr.range(0, COMPLEXES_PER_FACE - 1), (step) => {
      const salt = index * 31 + step * 3 + (face + 1);
      const theta = Math.PI + (0.1 + 0.8 * hashUnit(salt, 41)) * Math.PI;
      const across = 0.12 + 0.48 * hashUnit(salt, 43);
      const base = cristaPoint(crista, theta, across, face);
      return {
        face,
        position: [base[0] + (face * COMPLEX.lift) / 2, base[1], base[2]],
        spin: hashUnit(salt, 47) * Math.PI * 2,
      } as const;
    })
  )
);

/**
 * Seeded spots for `count` round bodies of `radius` in the matrix gaps, clear
 * of the crista faces, their complexes and synthases, the wall, the cut and
 * each other. In a gap the molecules cross they keep to the back, out of the
 * molecules' way.
 */
function matrixSpots(
  count: number,
  salt: number,
  radius: number,
  avoid: readonly Point[]
) {
  const candidates = Arr.map(Arr.range(0, count * 16 - 1), (index) => {
    const gap = index % GAP_COUNT;
    const theta = Math.PI + (0.15 + 0.7 * hashUnit(index, salt)) * Math.PI;
    const share = 0.2 + 0.7 * hashUnit(index, salt + 1);
    const offset = (hashUnit(index, salt + 2) - 0.5) * 0.03;
    return { gap, point: gapPoint(gap, theta, share, offset), theta };
  });
  const clear = Arr.filter(candidates, ({ gap, point, theta }) => {
    const radial = Math.hypot(point[1] - arch(point[0]), point[2]);
    const [left, right] = [
      Arr.getUnsafe(CRISTAE, gap),
      Arr.getUnsafe(CRISTAE, gap + 1),
    ];
    const deep = Arr.contains(QUIET_GAPS, gap)
      ? point[2] + radius < -0.03
      : point[2] + radius < -0.16 &&
        Math.abs(theta - 1.5 * Math.PI) < 0.16 * Math.PI;
    return (
      deep &&
      gapClearance(gap, point) > radius + COMPLEX.lift + 0.01 &&
      radial + radius <
        Math.min(cristaReach(left, theta), cristaReach(right, theta))
    );
  });
  const taken = Arr.reduce(clear, avoid, (kept, { point }) =>
    Arr.every(kept, (other) => distance(other, point) > 2.2 * radius + 0.02)
      ? Arr.append(kept, point)
      : kept
  );
  return Arr.take(Arr.drop(taken, avoid.length), count);
}

/** The straight distance between two points. */
export function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * The nucleoids, each a compact bundle of the circular mitochondrial genome:
 * about 100 nm across under STED, about 70 nm once the antibodies that
 * label it are allowed for (Kukat et al., PNAS 108, 2011), drawn at the
 * 70 nm in the matrix gaps.
 */
export const NUCLEOID_RADIUS = 0.035;
export const NUCLEOIDS = matrixSpots(2, 61, NUCLEOID_RADIUS, []);

/**
 * The loop of one nucleoid's DNA, centred on `centre`: a closed coil that
 * winds back on itself as packed DNA does, `steps` points around.
 */
export function nucleoidLoop(centre: Point, seed: number, steps: number) {
  const phase = seed * 1.7;
  return Arr.map(Arr.range(0, steps - 1), (step): Point => {
    const turn = (step / steps) * Math.PI * 2;
    const wobble = 1 + 0.42 * Math.cos(5 * turn + phase);
    const reach = NUCLEOID_RADIUS * 0.62 * wobble;
    return [
      centre[0] + reach * Math.sin(turn) * 0.8,
      centre[1] + reach * Math.cos(turn),
      centre[2] + NUCLEOID_RADIUS * 0.45 * Math.sin(3 * turn + phase),
    ];
  });
}

/**
 * Dense matrix granules of amorphous calcium phosphate, 20 to 100 nm across
 * (Wolf et al., eLife 6, 2017), drawn 40 nm across.
 */
export const GRANULE_RADIUS = 0.02;
export const GRANULES = matrixSpots(7, 71, GRANULE_RADIUS, NUCLEOIDS);

/**
 * Ribosomes, about 25 nm across in the cytosol and a little smaller in the
 * matrix (Alberts et al., "Molecular Biology of the Cell", 7th ed., ch. 6).
 */
export const RIBOSOME_RADIUS = 0.0125;
export const MITORIBOSOMES = matrixSpots(
  22,
  81,
  RIBOSOME_RADIUS * 0.9,
  Arr.appendAll(NUCLEOIDS, GRANULES)
);
