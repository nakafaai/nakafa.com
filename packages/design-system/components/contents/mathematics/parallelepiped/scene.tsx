import { Line } from "@react-three/drei";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import type { ParallelepipedConfig } from "@repo/design-system/components/contents/mathematics/parallelepiped/model";
import { evaluateParallelepiped } from "@repo/design-system/components/contents/mathematics/parallelepiped/model";
import { ParameterSweep } from "@repo/design-system/components/contents/mathematics/sweep";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { Facets } from "@repo/design-system/components/three/facets";
import { GraphTag } from "@repo/design-system/components/three/tag";
import { STROKE_DASH } from "@repo/design-system/lib/plot";
import type { ComponentProps } from "react";
import { useMemo } from "react";

/** The first edge of every base, along +X. */
const U = { x: 2, y: 0, z: 0 } as const;
/**
 * The second edge of each base, turned towards -Z so u x v points along +Y:
 * a base of area 3 for the box, and of area 2.4 for the two sheared ones, as
 * the model computes them.
 */
const V = {
  coplanarFlat: { x: 0.9, y: 0, z: -1.2 },
  orthogonalBox: { x: 0, y: 0, z: -1.5 },
  shearedPrism: { x: 0.9, y: 0, z: -1.2 },
} as const;
/** The length of the third edge of each solid, which the model's altitude is the rise of. */
const LENGTH_W = { coplanarFlat: 1.3, orthogonalBox: 1.5, shearedPrism: 1.17 };
/** The compass direction, in the base plane, the third edge leans towards. */
const LEAN = Math.PI / 5;
/** The side of the square that marks the right angle at the foot of the altitude. */
const SQUARE = 0.14;

export function VectorParallelepipedScene({
  configuration,
  elevation,
  parts,
  sweep,
}: {
  readonly configuration: ParallelepipedConfig;
  readonly elevation: number;
  readonly parts: Readonly<
    Record<
      | "altitudeLine"
      | "baseParallelogram"
      | "parallelepipedMesh"
      | "vectorU"
      | "vectorV"
      | "vectorW",
      string
    >
  >;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const reading = evaluateParallelepiped(configuration, elevation);
  const v = V[configuration];
  const length = LENGTH_W[configuration];
  // The third edge rises by the model's altitude, and its shadow on the base keeps its length true.
  const ground = Math.sqrt(Math.max(0, length ** 2 - reading.altitude ** 2));
  const w = useMemo(
    () => ({
      x: Math.cos(LEAN) * ground,
      y: reading.altitude,
      z: -Math.sin(LEAN) * ground,
    }),
    [ground, reading.altitude]
  );

  const { base, faces } = useMemo(() => {
    const origin = { x: 0, y: 0, z: 0 };
    const uv = { x: U.x + v.x, y: 0, z: v.z };
    const lift = (point: typeof origin) => ({
      x: point.x + w.x,
      y: point.y + w.y,
      z: point.z + w.z,
    });
    return {
      base: [[origin, U, uv, v]],
      faces: [
        [lift(origin), lift(U), lift(uv), lift(v)],
        [origin, U, lift(U), lift(origin)],
        [v, uv, lift(uv), lift(v)],
        [origin, v, lift(v), lift(origin)],
        [U, uv, lift(uv), lift(U)],
      ],
    };
  }, [v, w]);

  return (
    <group>
      <ParameterSweep {...sweep} value={elevation} />
      <Facets color={colors.plane} faces={base} opacity={0.26} />
      {reading.coplanar ? null : (
        <Facets color={colors.curve} edgeWidth={1.8} faces={faces} />
      )}
      <ArrowHelper
        arrowSize={0.24}
        color={colors.curve}
        from={[0, 0, 0]}
        lineWidth={3.4}
        to={[U.x, U.y, U.z]}
      />
      <ArrowHelper
        arrowSize={0.24}
        color={colors.slope}
        from={[0, 0, 0]}
        lineWidth={3.4}
        to={[v.x, v.y, v.z]}
      />
      <ArrowHelper
        arrowSize={0.24}
        color={colors.accent}
        from={[0, 0, 0]}
        lineWidth={3.4}
        to={[w.x, w.y, w.z]}
      />
      {reading.coplanar ? null : (
        <>
          {/* The altitude h: the rise of w above the base, with its right angle */}
          <Line
            color={colors.alert}
            dashed
            dashSize={STROKE_DASH.dash}
            gapSize={STROKE_DASH.gap}
            lineWidth={2.2}
            points={[
              [w.x, w.y, w.z],
              [w.x, 0, w.z],
              [0, 0, 0],
            ]}
          />
          <Line
            color={colors.alert}
            lineWidth={1.6}
            points={[
              [w.x * (1 - SQUARE / ground), 0, w.z * (1 - SQUARE / ground)],
              [
                w.x * (1 - SQUARE / ground),
                SQUARE,
                w.z * (1 - SQUARE / ground),
              ],
              [w.x, SQUARE, w.z],
            ]}
          />
          <GraphTag
            anchorX="left"
            anchorY="top"
            color={colors.alert}
            gap={0.1}
            math={`h = ${quantity(reading.altitude, "", 2)}`}
            name={parts.altitudeLine}
            position={[w.x, 0, w.z]}
          />
          <GraphTag
            anchorX="left"
            anchorY="bottom"
            color={colors.curve}
            gap={0.12}
            math={`V = ${quantity(reading.volume, "", 2)}`}
            name={parts.parallelepipedMesh}
            position={[U.x + v.x + w.x, w.y, v.z + w.z]}
          />
        </>
      )}
      <GraphTag
        anchorX="center"
        anchorY="top"
        color={colors.curve}
        gap={0.36}
        math="\vec{u}"
        name={parts.vectorU}
        position={[U.x, 0, 0]}
      />
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.slope}
        gap={0.1}
        math="\vec{v}"
        name={parts.vectorV}
        position={[v.x, 0, v.z]}
      />
      <GraphTag
        anchorX="right"
        anchorY="bottom"
        color={colors.accent}
        gap={0.12}
        math="\vec{w}"
        name={parts.vectorW}
        position={[w.x, w.y, w.z]}
      />
      <GraphTag
        anchorX="left"
        anchorY="top"
        color={colors.plane}
        gap={0.12}
        math={`|\\vec{u} \\times \\vec{v}| = ${quantity(reading.baseArea, "", 1)}`}
        name={parts.baseParallelogram}
        position={[U.x + v.x, 0, v.z]}
      />
    </group>
  );
}
