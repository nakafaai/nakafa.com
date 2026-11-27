import type {
  Polysaccharide,
  Sugar,
} from "@repo/design-system/components/contents/biology/sugar/polymer";
import {
  chainOf,
  pairOf,
} from "@repo/design-system/components/contents/biology/sugar/polymer";
import type { Point } from "@repo/design-system/components/three/molecule/point";
import {
  add,
  aside,
  cross,
  dot,
  length,
  ORIGIN,
  scale,
  sub,
  unit,
} from "@repo/design-system/components/three/molecule/point";
import type { Molecule } from "@repo/design-system/components/three/molecule/shape";
import { Array as Arr } from "effect";

/** The height a carbohydrate is centred on and the camera first looks at, in scene units. */
export const MIDDLE = 0.72;

/** How wide a carbohydrate is drawn, in scene units, whatever its length in angstrom. */
const SPAN = 1.7;

/** How far the rings lean toward the viewer, in radians, so a chair reads as a chair and not as a flat hexagon. */
const LEAN = (28 * Math.PI) / 180;

/** How far apart the two sugars of a pair stand before they join, in angstrom. */
export const GAP = 4;

/**
 * How far past an atom's middle the atom reaches, how far a label stands
 * from the outermost atom, how far a sugar's name stands out from the
 * middle of its ring, how far below the molecule the released water rests,
 * and how near a bond an atom must be to count as above it, all in angstrom.
 */
const REACH = 1.2;
const MARGIN = 1.5;
const OUTWARD = 2;
const BELOW = 1.4;
const NEAR = 2.4;

/** The pose that lays the line from `from` to `to` along x, with the first ring's face leaning toward the viewer. */
function poseOf(from: Point, to: Point) {
  const along = unit(sub(to, from));
  const above = aside(along, [0, 0, 1]);
  const beside = cross(along, above);
  const middle = scale(add(from, to), 0.5);
  return (point: Point): Point => {
    const offset = sub(point, middle);
    const up = dot(offset, above);
    const side = dot(offset, beside);
    return [
      dot(offset, along),
      up * Math.cos(LEAN) - side * Math.sin(LEAN),
      up * Math.sin(LEAN) + side * Math.cos(LEAN),
    ];
  };
}

/** A molecule with every atom and hydrogen bond moved by `pose`. */
function posed(molecule: Molecule, pose: (point: Point) => Point): Molecule {
  return {
    atoms: Arr.map(molecule.atoms, (atom) => ({ ...atom, at: pose(atom.at) })),
    bonds: molecule.bonds,
    ties: Arr.map(molecule.ties, ([from, to]) => [pose(from), pose(to)]),
    traces: [],
  };
}

/** The box that holds every atom of a molecule, in angstrom. */
function boxOf(molecule: Molecule) {
  const range = (axis: 0 | 1 | 2) => {
    const places = Arr.map(molecule.atoms, (atom) => atom.at[axis]);
    return {
      max: Math.max(...places) + REACH,
      min: Math.min(...places) - REACH,
    };
  };
  return { x: range(0), y: range(1), z: range(2) };
}

/** How large one angstrom is drawn so `width` angstrom span the scene, and where the origin of the molecule then stands. */
function standOf(width: number) {
  const size = SPAN / width;
  return {
    place: (point: Point): Point => add([0, MIDDLE, 0], scale(point, size)),
    size,
  };
}

/**
 * Where a pair of sugars is in its reaction at `phase`, from 0, two free
 * sugars, to 1, a disaccharide with its water gone. In the first half the
 * sugars close the gap, `apart` falling from 1 to 0; at the half they are
 * `bonded`; in the second half the water drifts away, `drift` rising from
 * 0 to 1.
 */
export function stageOf(phase: number) {
  const ease = (share: number) => share * share * (3 - share * 2);
  const bonded = phase >= 0.5;
  return {
    apart: bonded ? 0 : ease(1 - phase * 2),
    bonded,
    drift: bonded ? ease(phase * 2 - 1) : 0,
  };
}

/**
 * A disaccharide laid out for the camera: the joined molecule and its two
 * whole sugars in angstrom, lying along x with the glycosidic bond in the
 * middle; how large one angstrom is drawn; the box the camera frames, which
 * holds the sugars at their widest and the water; where the water leaves
 * from and where it rests; and, in scene units, where the names of the two
 * sugars and of the bond stand.
 */
export function pairLayout(sugar: Sugar) {
  const pair = pairOf(sugar);
  const [left, right] = pair.centers;
  const pose = poseOf(left, right);
  const molecule = posed(pair.molecule, pose);
  const box = boxOf(molecule);
  const bridge = pose(pair.bridge);
  const rest: Point = [bridge[0], box.y.min - BELOW, bridge[2] + NEAR];
  const bounds = {
    x: { max: box.x.max + GAP / 2, min: box.x.min - GAP / 2 },
    y: { max: box.y.max, min: rest[1] - REACH },
    z: box.z,
  };
  const { place, size } = standOf(bounds.x.max - bounds.x.min);
  const name = (center: Point, side: 1 | -1): Point =>
    place([pose(center)[0] + side * OUTWARD, box.y.min - MARGIN, 0]);
  return {
    bounds,
    bridge,
    first: posed(pair.first, pose),
    marks: {
      bond: place([bridge[0], box.y.max + MARGIN / 2, 0]),
      first: name(left, -1),
      second: name(right, 1),
    },
    molecule,
    rest,
    second: posed(pair.second, pose),
    size,
    stand: place(ORIGIN),
  };
}

/**
 * A polysaccharide laid out for the camera: its atoms in angstrom along x,
 * cellulose with the neighbouring chain of its sheet and the hydrogen bonds
 * between them; how large one angstrom is drawn; the box the camera frames;
 * the first part of the neighbouring chain, past the last part when there
 * is none; and, in scene units, where the name of its first glycosidic bond
 * stands, right above that bond.
 */
export function chainLayout(polysaccharide: Polysaccharide, units: number) {
  const chain = chainOf(polysaccharide, units);
  const start = Arr.headNonEmpty(chain.centers);
  const far = Arr.reduce(chain.centers, start, (best, center) =>
    length(sub(center, start)) > length(sub(best, start)) ? center : best
  );
  const pose = poseOf(start, far);
  const paired = chain.ties.length > 0;
  const molecule = posed(
    {
      atoms: paired
        ? [...chain.molecule.atoms, ...chain.beside.atoms]
        : chain.molecule.atoms,
      bonds: paired
        ? [
            ...chain.molecule.bonds,
            ...Arr.map(chain.beside.bonds, (bond) => ({
              ...bond,
              from: bond.from + chain.molecule.atoms.length,
              to: bond.to + chain.molecule.atoms.length,
            })),
          ]
        : chain.molecule.bonds,
      ties: chain.ties,
      traces: [],
    },
    pose
  );
  const box = boxOf(molecule);
  const { place, size } = standOf(
    Math.max(box.x.max - box.x.min, (box.y.max - box.y.min) * 1.4)
  );
  const bridge = pose(
    Arr.reduceRight(chain.bridges, start, (_, first) => first)
  );
  const above = Math.max(
    ...Arr.map(
      Arr.filter(
        molecule.atoms,
        (atom) => Math.abs(atom.at[0] - bridge[0]) < NEAR
      ),
      (atom) => atom.at[1]
    )
  );
  return {
    beside: paired ? chain.centers.length : Number.POSITIVE_INFINITY,
    bounds: box,
    mark: place([bridge[0], above + REACH + MARGIN / 2, bridge[2]]),
    molecule,
    size,
    stand: place(ORIGIN),
  };
}
