import { useFrame } from "@react-three/fiber";
import type { Point } from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import type {
  Molecule,
  Trip,
} from "@repo/design-system/components/contents/biology/mitochondrion/respiration";
import {
  CYCLE,
  ease,
  presence,
  progress,
} from "@repo/design-system/components/contents/biology/mitochondrion/respiration";
import { ATOM_COLORS } from "@repo/design-system/lib/material/atom";
import { ORGANELLE_COLORS } from "@repo/design-system/lib/material/organelle";
import { Array as Arr, Match, Option } from "effect";
import type { RefObject } from "react";
import { useEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The elements the models are built of, each in its CPK colour, its ball
 * drawn at about three quarters of its van der Waals radius in ångström
 * (Bondi, J. Phys. Chem. 68, 1964), so neighbouring atoms overlap as in a
 * space-filling model.
 */
const ELEMENTS = {
  C: { color: ATOM_COLORS.cpkCarbon, radius: 1.22 },
  H: { color: ATOM_COLORS.cpkHydrogen, radius: 0.86 },
  N: { color: ATOM_COLORS.cpkNitrogen, radius: 1.12 },
  O: { color: ATOM_COLORS.cpkOxygen, radius: 1.09 },
  P: { color: ORGANELLE_COLORS.cpkPhosphorus, radius: 1.3 },
} as const;

/** An atom of a model: its element and where it sits, in ångström. */
type Atom = readonly [keyof typeof ELEMENTS, number, number, number];

/** The ring atoms of a hexagon of `radius` ångström at angle steps of 60 degrees from `turn`, round `x`, `y`. */
function hexagon(radius: number, turn: number, x = 0, y = 0) {
  return Arr.map(Arr.range(0, 5), (step) => {
    const angle = turn + (step * Math.PI) / 3;
    return [
      x + radius * Math.cos(angle),
      y + radius * Math.sin(angle),
    ] as const;
  });
}

/** Glucose: the pyranose ring of five carbons and one oxygen, an OH on four of its carbons, and the CH2OH arm. */
function glucose(): readonly Atom[] {
  const ring = hexagon(1.45, Math.PI / 6);
  const out = hexagon(2.85, Math.PI / 6);
  const [ox, oy] = Arr.getUnsafe(ring, 0);
  const [armX, armY] = Arr.getUnsafe(out, 5);
  return [
    ["O", ox, oy, 0.25],
    ...Arr.map(
      Arr.drop(ring, 1),
      ([x, y], index): Atom => ["C", x, y, index % 2 === 0 ? -0.25 : 0.25]
    ),
    ...Arr.map(Arr.range(1, 4), (index): Atom => {
      const [x, y] = Arr.getUnsafe(out, index);
      return ["O", x, y, index % 2 === 0 ? -0.4 : 0.4];
    }),
    ["C", armX, armY, 0.5],
    ["O", armX + 1.1, armY + 0.9, 0.7],
  ];
}

/**
 * Pyruvic acid, CH3COCOOH, or lactic acid, CH3CH(OH)COOH: the same three
 * carbons and three oxygens, lactic acid carrying the two hydrogens that
 * NADH hands to pyruvate.
 */
function threeCarbon(lactate: boolean): readonly Atom[] {
  const skeleton: readonly Atom[] = [
    ["C", -1.25, 0, 0],
    ["C", 0, 0.72, 0],
    ["C", 1.25, 0, 0],
    ["O", 0, 1.98, 0],
    ["O", -1.25, -1.24, 0],
    ["O", -2.32, 0.62, 0],
    ["H", 2.05, 0.6, 0.45],
    ["H", 1.45, -0.6, 0.8],
    ["H", 1.4, -0.5, -0.85],
    ["H", -3.05, 0.1, 0],
  ];
  return lactate
    ? Arr.appendAll(skeleton, [
        ["H", 0.82, 2.4, 0],
        ["H", 0, 0.95, -1.05],
      ] as const)
    : skeleton;
}

/** Ethanol, CH3CH2OH. */
const ETHANOL: readonly Atom[] = [
  ["C", -0.78, -0.2, 0],
  ["C", 0.62, 0.42, 0],
  ["O", 1.75, -0.45, 0],
  ["H", -0.9, -1.25, 0.3],
  ["H", -1.5, 0.35, 0.6],
  ["H", -1.0, 0, -1.0],
  ["H", 0.7, 1.1, 0.85],
  ["H", 0.75, 1.0, -0.85],
  ["H", 2.55, 0.05, 0],
];

/** NADH by the nicotinamide ring that carries the hydrogen, its two hydrogens, and its amide arm. */
function carrier(): readonly Atom[] {
  return [
    ...Arr.map(
      hexagon(1.4, Math.PI / 2),
      ([x, y], index): Atom => [index === 3 ? "N" : "C", x, y, 0]
    ),
    ["H", 0.6, 2.25, 0.7],
    ["H", -0.6, 2.25, -0.7],
    ["C", 2.45, -0.75, 0],
    ["O", 3.5, -0.15, 0],
    ["N", 2.45, -2.05, 0],
  ];
}

/** ATP by its adenine rings and its chain of three phosphates, each with an oxygen. */
function atp(): readonly Atom[] {
  const six = hexagon(1.3, 0);
  const [ax, ay] = Arr.getUnsafe(six, 2);
  const [bx, by] = Arr.getUnsafe(six, 3);
  return [
    ...Arr.map(
      six,
      ([x, y], index): Atom => [index % 2 === 0 ? "N" : "C", x, y, 0]
    ),
    ["N", ax - 1.15, ay + 0.55, 0],
    ["C", (ax + bx) / 2 - 1.9, (ay + by) / 2, 0],
    ["N", bx - 1.15, by - 0.55, 0],
    ...Arr.flatMap(Arr.range(0, 2), (index): readonly Atom[] => [
      ["P", -4.1 - 1.55 * index, -1.1 - 1.2 * index, 0.3 * (index % 2)],
      ["O", -4.1 - 1.55 * index, -1.2 - 1.2 * index, 1.45],
    ]),
  ];
}

/**
 * The space-filling model of each molecule, in ångström, its heavy atoms with
 * the hydrogens that tell two models apart. Oxygen, carbon dioxide and water
 * are drawn whole; NADH and ATP by their working parts.
 */
function atomsOf(molecule: Molecule): readonly Atom[] {
  return Match.value(molecule).pipe(
    Match.when("glucose", glucose),
    Match.when("pyruvate", () => threeCarbon(false)),
    Match.when("lactate", () => threeCarbon(true)),
    Match.when("ethanol", () => ETHANOL),
    Match.when("carbonDioxide", (): readonly Atom[] => [
      ["O", -1.16, 0, 0],
      ["C", 0, 0, 0],
      ["O", 1.16, 0, 0],
    ]),
    Match.when("oxygen", (): readonly Atom[] => [
      ["O", -0.6, 0, 0],
      ["O", 0.6, 0, 0],
    ]),
    Match.when("water", (): readonly Atom[] => [
      ["O", 0, 0, 0],
      ["H", -0.76, 0.59, 0],
      ["H", 0.76, 0.59, 0],
    ]),
    Match.when("carrier", carrier),
    Match.when("atp", atp),
    Match.exhaustive
  );
}

/**
 * How large each model is drawn, in micrometres per ångström: about 200
 * times life size, so a glucose spans about 0.16 µm. ATP, the longest, is
 * drawn at two thirds of that, so it does not crowd the cristae it leaves.
 */
function scaleOf(molecule: Molecule) {
  return molecule === "atp" ? 0.013 : 0.02;
}

/** The merged, vertex-coloured geometry of one molecule's model, centred on its middle. */
function glyphGeometry(molecule: Molecule) {
  const atoms = atomsOf(molecule);
  const scale = scaleOf(molecule);
  const centre = Arr.reduce(atoms, new Vector3(), (sum, [, x, y, z]) =>
    sum.add(new Vector3(x, y, z))
  ).divideScalar(atoms.length);
  const balls = Arr.map(atoms, ([element, x, y, z]) => {
    const ball = new SphereGeometry(ELEMENTS[element].radius * scale, 16, 12);
    const tint = new Color(ELEMENTS[element].color);
    const count = ball.getAttribute("position").count;
    ball.translate(
      (x - centre.x) * scale,
      (y - centre.y) * scale,
      (z - centre.z) * scale
    );
    ball.setAttribute(
      "color",
      new Float32BufferAttribute(
        Arr.flatMap(Arr.range(0, count - 1), () => [tint.r, tint.g, tint.b]),
        3
      )
    );
    return ball;
  });
  const merged = mergeGeometries([...balls], false);
  for (const ball of balls) {
    ball.dispose();
  }
  return merged;
}

/** A reusable pose for writing instance matrices without allocating each frame. */
function usePose() {
  return useMemo(
    () => ({
      matrix: new Matrix4(),
      point: new Vector3(),
      size: new Vector3(),
      turn: new Quaternion(),
    }),
    []
  );
}

/**
 * Every molecule of one kind on its trips, as one instanced draw: each moves
 * along its path while it shows, grows as it forms and shrinks as it goes,
 * and tumbles slowly as molecules do. `clock` is the run's time in seconds.
 */
export function Molecules({
  clock,
  molecule,
  trips,
}: {
  readonly clock: RefObject<number>;
  readonly molecule: Molecule;
  readonly trips: readonly Trip[];
}) {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => glyphGeometry(molecule), [molecule]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const paths = useMemo(
    () =>
      Arr.map(trips, (trip) => ({
        axis: new Vector3(
          Math.cos(trip.spin * 6.28),
          0.6,
          Math.sin(trip.spin * 6.28)
        ).normalize(),
        curve: new CatmullRomCurve3(
          Arr.map(trip.path, (point: Point) => new Vector3(...point)),
          false,
          "centripetal"
        ),
        trip,
      })),
    [trips]
  );
  const pose = usePose();

  useFrame(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const phase = clock.current / CYCLE;
    Arr.forEach(paths, ({ axis, curve, trip }, index) => {
      const share = progress(trip, phase);
      if (Option.isNone(share)) {
        pose.matrix.makeScale(0, 0, 0);
        target.setMatrixAt(index, pose.matrix);
        return;
      }
      curve.getPointAt(ease(share.value), pose.point);
      pose.turn.setFromAxisAngle(
        axis,
        trip.spin * Math.PI * 2 + share.value * Math.PI * 1.5
      );
      const size = presence(share.value);
      pose.size.set(size, size, size);
      pose.matrix.compose(pose.point, pose.turn, pose.size);
      target.setMatrixAt(index, pose.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      args={[geometry, undefined, trips.length]}
      frustumCulled={false}
      ref={mesh}
    >
      <meshPhysicalMaterial
        clearcoat={0.8}
        clearcoatRoughness={0.18}
        roughness={0.36}
        vertexColors
      />
    </instancedMesh>
  );
}
