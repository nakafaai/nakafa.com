import { latheProfile } from "@repo/design-system/components/contents/chemistry/glassware";
import {
  GlassMaterial,
  LiquidMaterial,
} from "@repo/design-system/components/three/physical";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** How thick the panes of a glass tank are. */
const PANE = 0.03;

/**
 * A rectangular glass tank standing on the bench, open at the top: four
 * panes and a floor of plate glass, `width` by `depth` inside and `height`
 * tall, on a thin dark sealing strip.
 */
export function Tank({
  depth,
  height,
  width,
}: {
  readonly depth: number;
  readonly height: number;
  readonly width: number;
}) {
  const panes = [
    {
      at: [0, height / 2, depth / 2 + PANE / 2],
      key: "front",
      size: [width + PANE * 2, height, PANE],
    },
    {
      at: [0, height / 2, -depth / 2 - PANE / 2],
      key: "back",
      size: [width + PANE * 2, height, PANE],
    },
    {
      at: [width / 2 + PANE / 2, height / 2, 0],
      key: "right",
      size: [PANE, height, depth],
    },
    {
      at: [-width / 2 - PANE / 2, height / 2, 0],
      key: "left",
      size: [PANE, height, depth],
    },
  ] as const;

  return (
    <group>
      <mesh position={[0, 0.008, 0]} receiveShadow>
        <boxGeometry
          args={[width + PANE * 2 + 0.02, 0.016, depth + PANE * 2 + 0.02]}
        />
        <meshStandardMaterial
          color={APPARATUS_COLORS.rubberFoot}
          roughness={0.8}
        />
      </mesh>
      <mesh position={[0, 0.016 + PANE / 2, 0]} renderOrder={2}>
        <boxGeometry args={[width, PANE, depth]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.16} />
      </mesh>
      {Arr.map(panes, (pane) => (
        <mesh
          castShadow
          key={pane.key}
          position={[pane.at[0], pane.at[1] + 0.016, pane.at[2]]}
          renderOrder={3}
        >
          <boxGeometry args={[pane.size[0], pane.size[1], pane.size[2]]} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.1} />
        </mesh>
      ))}
    </group>
  );
}

/** The liquid in a tank of `width` by `depth`, standing `level` deep above the tank's floor, in its `color`. */
export function TankLiquid({
  color,
  depth,
  level,
  width,
}: {
  readonly color: string;
  readonly depth: number;
  readonly level: number;
  readonly width: number;
}) {
  return (
    <mesh position={[0, 0.016 + PANE + level / 2, 0]} renderOrder={1}>
      <boxGeometry args={[width - 0.004, level, depth - 0.004]} />
      <LiquidMaterial color={color} opacity={0.4} />
    </mesh>
  );
}

/**
 * An open glass tube standing upright from `bottom`, `height` tall and
 * `radius` wide inside, with a fire-polished rim at each open end.
 */
export function Tube({
  bottom = 0,
  height,
  radius,
}: {
  readonly bottom?: number;
  readonly height: number;
  readonly radius: number;
}) {
  return (
    <group position={[0, bottom, 0]}>
      <mesh castShadow position={[0, height / 2, 0]} renderOrder={3}>
        <cylinderGeometry
          args={[radius + 0.012, radius + 0.012, height, 40, 1, true]}
        />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.22} />
      </mesh>
      <mesh
        position={[0, height, 0]}
        renderOrder={3}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[radius + 0.012, 0.008, 10, 40]} />
        <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.5} />
      </mesh>
    </group>
  );
}

/**
 * A column of liquid in a round tube, from `bottom` up to `level`, as one
 * solid of revolution: water and oil wet glass and climb the wall in a
 * concave meniscus, while a `convex` one, such as mercury, bulges up in the
 * middle.
 */
export function Column({
  bottom,
  color,
  convex = false,
  level,
  opacity = 0.7,
  radius,
}: {
  readonly bottom: number;
  readonly color: string;
  readonly convex?: boolean;
  readonly level: number;
  readonly opacity?: number;
  readonly radius: number;
}) {
  const points = useMemo(() => {
    const rise = radius * (convex ? -0.3 : 0.3);
    return latheProfile([
      [0.0005, bottom],
      [radius, bottom],
      [radius, level + rise],
      [radius * 0.82, level + rise * 0.4],
      [radius * 0.5, level + rise * 0.1],
      [0.0005, level],
    ]);
  }, [bottom, convex, level, radius]);

  return (
    <mesh renderOrder={1}>
      <latheGeometry args={[points, 36]} />
      <LiquidMaterial color={color} opacity={opacity} />
    </mesh>
  );
}
