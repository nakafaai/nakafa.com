import type { Outline } from "@repo/design-system/components/contents/biology/respirometer/glass";
import {
  arc,
  ClearGlass,
  useLathe,
} from "@repo/design-system/components/contents/biology/respirometer/glass";
import {
  BUNG,
  DELIVERY,
} from "@repo/design-system/components/contents/biology/yeast/ferment";
import {
  innerRadius,
  TEST_TUBE,
} from "@repo/design-system/components/contents/biology/yeast/tube";
import { RESPIROMETER_COLORS } from "@repo/design-system/lib/material/respirometer";
import { Array as Arr, Option } from "effect";
import { useEffect, useMemo } from "react";
import {
  BackSide,
  CurvePath,
  FrontSide,
  LineCurve3,
  Path,
  QuadraticBezierCurve3,
  Shape,
  ShapeGeometry,
  Vector3,
} from "three";

/** A point in the scene, in metres. */
type Point = readonly [number, number, number];

/** The test tube's outer radius, in metres. */
const TEST_RADIUS = TEST_TUBE.diameter / 2;

/**
 * The test tube's wall turned from its foot, as the respirometer lab turns
 * its boiling tube: a round bottom, a straight wall, a fire-polished lip,
 * and the inside followed back down to the foot.
 */
const TEST_TUBE_OUTLINE: Outline = [
  ...arc(0, TEST_RADIUS, TEST_RADIUS, -Math.PI / 2, 0, 12),
  ...arc(
    TEST_RADIUS - TEST_TUBE.wall / 2,
    TEST_TUBE.length - TEST_TUBE.wall / 2,
    TEST_TUBE.wall / 2,
    0,
    Math.PI,
    6
  ),
  ...arc(0, TEST_RADIUS, innerRadius(TEST_TUBE), 0, -Math.PI / 2, 12),
];

/** The limewater's test tube standing on its round foot at the origin, in the same glass as the boiling tubes. */
export function TestTube() {
  const wall = useLathe(TEST_TUBE_OUTLINE, 40);
  return (
    <mesh geometry={wall}>
      <ClearGlass opacity={0.24} />
    </mesh>
  );
}

/** How far each hole of the bung is from its axis, in metres. */
export const HOLE_OFFSET = 0.0048;

/** The radius of each hole in the bung, in metres: as wide as the tubing pushed through it. */
const HOLE = DELIVERY.outer + 0.0001;

/** The rubber bung's side turned from its foot: a taper whose edges are rounded, as moulded rubber is. */
const BUNG_SIDE: Outline = [
  ...arc(BUNG.foot - 0.001, 0.001, 0.001, -Math.PI / 2, 0, 4),
  ...arc(BUNG.top - 0.0012, BUNG.height - 0.0012, 0.0012, 0, Math.PI / 2, 4),
];

/** A disc of `radius` pierced by the bung's two holes: one for the thermometer, one for the delivery tube. */
function piercedDisc(radius: number) {
  const disc = new Shape().absarc(0, 0, radius, 0, Math.PI * 2, false);
  disc.holes = Arr.map([-1, 1] as const, (side) =>
    new Path().absarc(side * HOLE_OFFSET, 0, HOLE, 0, Math.PI * 2, true)
  );
  return new ShapeGeometry(disc, 40);
}

/** The bung's rubber, moulded as the respirometer lab's bungs are; a hole's lining shows its inside. */
function Rubber({ lining = false }: { readonly lining?: boolean }) {
  return (
    <meshPhysicalMaterial
      clearcoat={0.15}
      clearcoatRoughness={0.6}
      color={RESPIROMETER_COLORS.rubber}
      roughness={0.78}
      side={lining ? BackSide : FrontSide}
    />
  );
}

/**
 * The size 4 rubber bung bored with two holes, its foot at the origin: the
 * same bung as the respirometer lab's, pierced for the thermometer and the
 * delivery tube, each hole lined with rubber.
 */
export function Bung() {
  const side = useLathe(BUNG_SIDE, 40);
  const faces = useMemo(
    () => ({
      foot: piercedDisc(BUNG.foot - 0.001),
      top: piercedDisc(BUNG.top - 0.0012),
    }),
    []
  );
  useEffect(
    () => () => {
      faces.foot.dispose();
      faces.top.dispose();
    },
    [faces]
  );
  return (
    <group>
      <mesh castShadow geometry={side} receiveShadow>
        <Rubber />
      </mesh>
      <mesh
        geometry={faces.top}
        position={[0, BUNG.height, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <Rubber />
      </mesh>
      <mesh geometry={faces.foot} rotation={[Math.PI / 2, 0, 0]}>
        <Rubber />
      </mesh>
      {Arr.map([-1, 1] as const, (hole) => (
        <mesh key={hole} position={[hole * HOLE_OFFSET, BUNG.height / 2, 0]}>
          <cylinderGeometry args={[HOLE, HOLE, BUNG.height, 16, 1, true]} />
          <Rubber lining />
        </mesh>
      ))}
    </group>
  );
}

/** How tightly the delivery tube is bent at each corner, in metres. */
const BEND = 0.012;

/** The point `back` metres short of `to` on the way there from `from`. */
function shortOf(from: Vector3, to: Vector3, back: number) {
  return to
    .clone()
    .sub(from)
    .setLength(Math.max(0, to.distanceTo(from) - back))
    .add(from);
}

/**
 * A bent glass delivery tube through `points`: straight runs joined by
 * smooth bends, as tubing softened in a flame bends, its 4 mm bore showing
 * inside its 6 mm wall, in the glass of the respirometer lab's capillary.
 */
export function DeliveryTube({
  points,
}: {
  readonly points: readonly Point[];
}) {
  const path = useMemo(() => {
    const curve = new CurvePath<Vector3>();
    const corners = Arr.map(points, (point) => new Vector3(...point));
    const start = Option.getOrElse(Arr.head(corners), () => new Vector3());
    const end = Option.getOrElse(Arr.last(corners), () => start);
    // Each inner corner with the point after it: a straight run up to the
    // bend, then a bend that leaves towards the next point.
    const bends = Arr.zip(Arr.drop(corners, 1), Arr.drop(corners, 2));
    const last = Arr.reduce(bends, start, (from, [corner, next]) => {
      const before = shortOf(from, corner, BEND);
      const after = shortOf(next, corner, BEND);
      curve.add(new LineCurve3(from, before));
      curve.add(new QuadraticBezierCurve3(before, corner, after));
      return after;
    });
    curve.add(new LineCurve3(last, end));
    return curve;
  }, [points]);
  return (
    <group>
      <mesh castShadow>
        <tubeGeometry args={[path, 220, DELIVERY.outer, 16, false]} />
        <ClearGlass opacity={0.3} />
      </mesh>
      <mesh>
        <tubeGeometry args={[path, 220, DELIVERY.bore, 12, false]} />
        <ClearGlass opacity={0.16} />
      </mesh>
    </group>
  );
}
