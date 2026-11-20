import type { Outline } from "@repo/design-system/components/contents/biology/respirometer/glass";
import {
  arc,
  BOILING_TUBE,
  ClearGlass,
  ClearLiquid,
  useLathe,
} from "@repo/design-system/components/contents/biology/respirometer/glass";
import { RESPIROMETER_COLORS } from "@repo/design-system/lib/material/respirometer";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { Path, Shape, ShapeGeometry } from "three";

/**
 * A 1000 ml Griffin low-form beaker, in metres: outer radius, height,
 * wall, and the bath water's depth in it.
 */
export const BEAKER = {
  height: 0.145,
  level: 0.1,
  radius: 0.0525,
  wall: 0.0018,
} as const;

/** The heel radius where the beaker's floor turns up into its wall, in metres. */
const HEEL = 0.008;

/** The beaker's wall turned from its foot, out over the rim bead and back down inside. */
const BEAKER_OUTLINE: Outline = [
  [0, 0],
  ...arc(BEAKER.radius - HEEL, HEEL, HEEL, -Math.PI / 2, 0, 8),
  ...arc(
    BEAKER.radius - BEAKER.wall / 2,
    BEAKER.height - BEAKER.wall * 0.65,
    BEAKER.wall * 0.65,
    0,
    Math.PI,
    8
  ),
  ...arc(BEAKER.radius - HEEL, HEEL, HEEL - BEAKER.wall, 0, -Math.PI / 2, 8),
  [0, BEAKER.wall],
];

/** How far the beaker's pouring lip reaches out past its rim, in metres, and its bearing: back and to the left. */
const SPOUT = { bearing: -Math.PI * 0.75, reach: 0.006 } as const;

/** The bearing the printed graduations face: the front, a little to the right. */
const MARKS_BEARING = Math.PI * 0.4;

/** The bath's inside radius, a hair inside the glass so the two never touch. */
const BATH = BEAKER.radius - BEAKER.wall - 0.0001;

/** The heel's radius on the inside of the glass, where the water's floor turns up. */
const HEEL_IN = HEEL - BEAKER.wall - 0.0001;

/**
 * The meniscus water draws up clean glass, in metres: how high it climbs
 * the wall, and how far in from the glass the surface is flat again.
 */
const MENISCUS = { rise: 0.0015, reach: 0.004 } as const;

/**
 * The water's floor, heel and wall turned up to the meniscus at the glass,
 * curving down to the flat surface `MENISCUS.reach` in from the wall. The
 * flat surface itself is cut separately, around the tubes standing in it.
 */
const WATER_OUTLINE: Outline = [
  [0, BEAKER.wall + 0.0001],
  ...arc(BATH - HEEL_IN, HEEL, HEEL_IN, -Math.PI / 2, 0, 8),
  ...Arr.map(Arr.range(0, 6), (step) => {
    const share = 1 - step / 6;
    return [
      BATH - MENISCUS.reach * (1 - share),
      BEAKER.level + MENISCUS.rise * share ** 3,
    ] as const;
  }),
];

/**
 * The flat water surface inside the meniscus, with a round hole wherever a
 * boiling tube stands in the bath, so no water shows inside the tubes. Each
 * well is a tube's centre on the beaker's left to right line, in metres.
 */
function useBathSurface(wells: readonly number[]) {
  const geometry = useMemo(() => {
    const surface = new Shape().absarc(
      0,
      0,
      BATH - MENISCUS.reach,
      0,
      Math.PI * 2,
      false
    );
    surface.holes = Arr.map(wells, (well) =>
      new Path().absarc(well, 0, BOILING_TUBE.radius, 0, Math.PI * 2, true)
    );
    return new ShapeGeometry(surface, 48);
  }, [wells]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** The thin wet line of water drawn up a glass circle of `radius` at the surface. */
function WetLine({
  radius,
  x,
}: {
  readonly radius: number;
  readonly x: number;
}) {
  return (
    <mesh
      position={[x, BEAKER.level + 0.0009, 0]}
      renderOrder={2}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <torusGeometry args={[radius, 0.0006, 8, 96]} />
      <ClearLiquid color={RESPIROMETER_COLORS.bath} opacity={0.55} />
    </mesh>
  );
}

/**
 * The bath: a 1000 ml beaker with a pouring lip and white enamel
 * graduations, filled with water to `BEAKER.level` under a meniscus, around
 * the boiling tubes standing in it at `wells`.
 */
export function Beaker({ wells }: { readonly wells: readonly number[] }) {
  const lathe = useLathe(BEAKER_OUTLINE, 72);
  const wall = useMemo(() => {
    const geometry = lathe.clone();
    const position = geometry.getAttribute("position");
    Arr.forEach(Arr.range(0, position.count - 1), (index) => {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const turn = Math.atan2(z, x) - SPOUT.bearing;
      const off = Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn)));
      const lip =
        Math.max(0, 1 - off / 0.32) *
        Math.max(0, (y - (BEAKER.height - 0.022)) / 0.022);
      const reach = 1 + (SPOUT.reach * lip ** 2) / BEAKER.radius;
      position.setXYZ(index, x * reach, y, z * reach);
    });
    geometry.computeVertexNormals();
    return geometry;
  }, [lathe]);
  useEffect(() => () => wall.dispose(), [wall]);
  const bath = useLathe(WATER_OUTLINE, 72);
  const surface = useBathSurface(wells);
  // Each graduation stands where its volume of water fills the inside,
  // V = π r² h, a long mark every 200 ml and a short one between.
  const marks = Arr.map(Arr.range(2, 9), (hundreds) => ({
    height:
      BEAKER.wall +
      (hundreds * 1e-4) / (Math.PI * (BEAKER.radius - BEAKER.wall) ** 2),
    hundreds,
    span: hundreds % 2 === 0 ? 0.42 : 0.24,
  }));
  return (
    <group>
      <mesh geometry={wall} renderOrder={3}>
        <ClearGlass opacity={0.2} />
      </mesh>
      <mesh geometry={bath} renderOrder={2}>
        <ClearLiquid color={RESPIROMETER_COLORS.bath} opacity={0.12} />
      </mesh>
      <mesh
        geometry={surface}
        position={[0, BEAKER.level, 0]}
        renderOrder={2}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ClearLiquid color={RESPIROMETER_COLORS.bath} opacity={0.12} />
      </mesh>
      <WetLine radius={BATH - 0.0006} x={0} />
      {Arr.map(wells, (well) => (
        <WetLine key={well} radius={BOILING_TUBE.radius + 0.0006} x={well} />
      ))}
      {Arr.map(marks, (mark) => (
        <mesh
          key={mark.hundreds}
          position={[0, mark.height, 0]}
          rotation={[Math.PI / 2, 0, MARKS_BEARING - mark.span / 2]}
        >
          <torusGeometry
            args={[BEAKER.radius + 0.000_12, 0.000_28, 4, 24, mark.span]}
          />
          <meshStandardMaterial
            color={RESPIROMETER_COLORS.enamel}
            roughness={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}
