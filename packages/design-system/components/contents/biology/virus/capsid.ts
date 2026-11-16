import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, HashMap, Option } from "effect";

/** A point or a direction in a virion's own frame. */
type Point = readonly [number, number, number];

/** A triangle of three corners. */
type Triangle = readonly [Point, Point, Point];

/** The height of the two rings of a polar icosahedron of circumradius 1. */
const RING_HEIGHT = 1 / Math.sqrt(5);

/** The radius of those two rings. */
const RING_RADIUS = 2 / Math.sqrt(5);

/** Two points closer than this are one point. */
const SAME = 1e-6;

function ringPoint(step: number, y: number): Point {
  const angle = (step * Math.PI) / 5;
  return [RING_RADIUS * Math.cos(angle), y, RING_RADIUS * Math.sin(angle)];
}

function plus(a: Point, b: Point): Point {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function minus(a: Point, b: Point): Point {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function times(a: Point, k: number): Point {
  return [a[0] * k, a[1] * k, a[2] * k];
}

function cross(a: Point, b: Point): Point {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function unit(a: Point): Point {
  return times(a, 1 / Math.hypot(...a));
}

function keyOf(point: Point) {
  return Arr.join(
    Arr.map(point, (value) => (Math.round(value / SAME) * SAME).toFixed(5)),
    ","
  );
}

/**
 * The twenty faces of an icosahedron of circumradius 1 standing on a
 * five-fold axis along y, wound so each face's normal points out: five round
 * the top vertex, ten in the belt between the two rings, five round the
 * bottom one. A phage head is built on this axis, its tail on a vertex.
 */
export function icosahedronFaces(): readonly Triangle[] {
  const top: Point = [0, 1, 0];
  const bottom: Point = [0, -1, 0];
  const upper = (step: number) => ringPoint(2 * (step % 5), RING_HEIGHT);
  const lower = (step: number) => ringPoint(2 * (step % 5) + 1, -RING_HEIGHT);
  return Arr.flatMap(Arr.range(0, 4), (step): readonly Triangle[] => [
    [top, upper(step + 1), upper(step)],
    [upper(step), upper(step + 1), lower(step)],
    [upper(step + 1), lower(step + 1), lower(step)],
    [bottom, lower(step), lower(step + 1)],
  ]);
}

/** The outward normal of a face. */
export function faceNormal([a, b, c]: Triangle) {
  return unit(cross(minus(b, a), minus(c, a)));
}

/**
 * Stretches an icosahedron along its five-fold axis by `extra`, as a prolate
 * phage head is: the belt between the two rings grows taller and the two caps
 * move apart, so the faces stay flat and meet the caps without a seam.
 */
export function elongate(point: Point, extra: number): Point {
  const [x, y, z] = point;
  if (Math.abs(y) <= RING_HEIGHT + SAME) {
    return [x, y * (1 + extra / RING_HEIGHT), z];
  }
  return [x, y + Math.sign(y) * extra, z];
}

/**
 * The capsomeres of an icosahedral capsid with triangulation number
 * `frequency` squared, on the flat faces of an icosahedron of circumradius 1:
 * 12 pentons at the vertices and 10 (T - 1) hexons between them, 252 in all
 * for adenovirus (T = 25). Each carries the direction it faces, the mean of
 * the faces it sits on, and `extra` stretches the shell along its axis.
 */
export function capsomeres(frequency: number, extra = 0) {
  const grid = Arr.flatMap(icosahedronFaces(), (face) => {
    const [a, b, c] = face;
    const normal = faceNormal(face);
    return Arr.flatMap(Arr.range(0, frequency), (i) =>
      Arr.map(Arr.range(0, frequency - i), (j) => ({
        corner: (i === 0 && j === 0) || i === frequency || j === frequency,
        normal,
        position: plus(
          a,
          plus(
            times(minus(b, a), i / frequency),
            times(minus(c, a), j / frequency)
          )
        ),
      }))
    );
  });
  const merged = Arr.reduce(
    grid,
    HashMap.empty<
      string,
      { corner: boolean; normal: Point; position: Point }
    >(),
    (found, spot) => {
      const key = keyOf(spot.position);
      return HashMap.set(
        found,
        key,
        Option.match(HashMap.get(found, key), {
          onNone: () => spot,
          onSome: (seen) => ({
            ...seen,
            normal: plus(seen.normal, spot.normal),
          }),
        })
      );
    }
  );
  return Arr.map(Arr.fromIterable(HashMap.values(merged)), (spot) => {
    const normal = unit(spot.normal);
    const belt = Math.abs(spot.position[1]) < RING_HEIGHT - SAME;
    const lean = belt ? 1 + extra / RING_HEIGHT : 1;
    return {
      kind: spot.corner ? ("penton" as const) : ("hexon" as const),
      normal: unit([normal[0], normal[1] / lean, normal[2]]),
      position: elongate(spot.position, extra),
    };
  });
}

/**
 * The coat proteins of a helical capsid such as tobacco mosaic virus: 16.3
 * subunits a turn, each turn `pitch` along the rod, for a rod `length` long.
 * Each is the angle it faces about the rod's axis and its place along it.
 */
export function helicalSubunits({
  length,
  perTurn,
  pitch,
}: {
  readonly length: number;
  readonly perTurn: number;
  readonly pitch: number;
}) {
  const count = Math.floor((length / pitch) * perTurn);
  return Arr.map(Arr.range(0, count - 1), (index) => ({
    angle: (index * Math.PI * 2) / perTurn,
    x: -length / 2 + (index * pitch) / perTurn,
  }));
}

/**
 * One of a T4 phage's six long tail fibres in the baseplate's frame, as it
 * stands before landing: from the rim of the baseplate up and out to its
 * knee, then down to its tip, a bent leg about 145 nm long in two halves.
 */
export function tailFibre(index: number, count: number) {
  const angle = (index / count) * Math.PI * 2 + Math.PI / count;
  const out = (reach: number, y: number): Point => [
    Math.cos(angle) * reach,
    y,
    Math.sin(angle) * reach,
  ];
  return [
    out(0.1, 0),
    out(0.26, 0.1),
    out(0.4, 0.15),
    out(0.5, 0),
    out(0.58, -0.22),
  ] as const;
}

/**
 * The twelve immunoglobulin domains of an IgG antibody gripping a spike, in
 * the frame of the spike's head: one Fab arm's tip on the head, the other arm
 * reaching aside, and the Fc stem pointing away, a Y about 15 nm across. Each
 * domain belongs to a heavy or a light chain and points along its arm.
 */
export function antibodyDomains() {
  const hinge: Point = [0.1, 0.2, 0];
  const arms: readonly (readonly [Point, Point, boolean])[] = [
    [[0, 0.02, 0], hinge, true],
    [plus(hinge, [0.2, -0.06, 0.06]), hinge, true],
    [hinge, plus(hinge, [0.02, 0.22, -0.02]), false],
  ];
  return Arr.flatMap(arms, ([from, to, fab]) => {
    const along = unit(minus(to, from));
    const side = unit(cross(along, [0, 0, 1]));
    return Arr.flatMap([0.25, 0.72] as const, (share) =>
      Arr.map([-1, 1] as const, (hand) => ({
        chain: fab && hand === 1 ? ("light" as const) : ("heavy" as const),
        direction: along,
        position: plus(
          plus(from, times(minus(to, from), share)),
          times(side, hand * 0.026)
        ),
      }))
    );
  });
}

/**
 * At most `count` points scattered through a ball of `radius`,
 * deterministically, for the ribonucleoproteins packed inside a virion.
 */
export function insideBall(count: number, radius: number, seed: number) {
  const candidates = Arr.map(
    Arr.range(0, count * 3 - 1),
    (index): Point => [
      (hashUnit(index, seed) - 0.5) * 2 * radius,
      (hashUnit(index + 97, seed) - 0.5) * 2 * radius,
      (hashUnit(index + 193, seed) - 0.5) * 2 * radius,
    ]
  );
  return Arr.take(
    Arr.filter(candidates, (point) => Math.hypot(...point) < radius),
    count
  );
}

/**
 * Double-stranded DNA packed in a capsid as a coaxial spool: `layers` shells
 * of helical winding from the wall inward, each running the other way along
 * the axis from the last, all inside a ball of `radius`, as cryo-electron
 * microscopy shows in herpesvirus and phage heads.
 */
export function spoolPath(layers: number, turns: number, radius: number) {
  return Arr.flatMap(Arr.range(0, layers - 1), (layer) => {
    const ring = radius * (0.92 - (0.72 * layer) / layers);
    const half = Math.sqrt(radius * radius - ring * ring) * 0.85;
    const samples = turns * 24;
    return Arr.map(Arr.range(0, samples), (step): Point => {
      const share = step / samples;
      const along = layer % 2 === 0 ? share : 1 - share;
      const angle = share * turns * Math.PI * 2 + layer;
      return [
        ring * Math.cos(angle),
        -half + 2 * half * along,
        ring * Math.sin(angle),
      ];
    });
  });
}

/**
 * A helix `length` long along y with `turns` turns of `radius`, starting at
 * angle `phase`: one strand of a ribonucleoprotein's twisted hairpin.
 */
export function helixPath({
  length,
  phase,
  radius,
  turns,
}: {
  readonly length: number;
  readonly phase: number;
  readonly radius: number;
  readonly turns: number;
}) {
  const samples = Math.ceil(turns * 16);
  return Arr.map(Arr.range(0, samples), (step): Point => {
    const share = step / samples;
    const angle = share * turns * Math.PI * 2 + phase;
    return [
      radius * Math.cos(angle),
      -length / 2 + share * length,
      radius * Math.sin(angle),
    ];
  });
}
