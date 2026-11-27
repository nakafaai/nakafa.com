import { Line } from "@react-three/drei";
import type { CrossOrder } from "@repo/design-system/components/contents/mathematics/cross/model";
import { evaluateCrossProduct } from "@repo/design-system/components/contents/mathematics/cross/model";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import { ParameterSweep } from "@repo/design-system/components/contents/mathematics/sweep";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import {
  createArcPoints,
  GRAPH_ANGLE_ARC_SEGMENTS,
  GRAPH_ARROW_SEGMENTS,
} from "@repo/design-system/components/three/data/quality";
import { Facets } from "@repo/design-system/components/three/facets";
import { GraphTag } from "@repo/design-system/components/three/tag";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useMemo } from "react";

/** The lengths of the two vectors, as the lesson and the model fix them. */
const LENGTH_U = 2;
const LENGTH_V = 1.5;
const ARC_RADIUS = 0.55;
/** How many arc radii out the angle's name stands, along the bisector. */
const TAG_REACH = 2.3;
const ARC_HEAD = 0.14;
/** Below this length the product has no direction left to draw. */
const VISIBLE = 0.05;

export function Vector3DCrossProductScene({
  angle,
  order,
  parts,
  sweep,
}: {
  readonly angle: number;
  readonly order: CrossOrder;
  readonly parts: Readonly<
    Record<
      "crossVector" | "curlArc" | "parallelogram" | "vectorU" | "vectorV",
      string
    >
  >;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const radians = (angle * Math.PI) / 180;
  const metrics = evaluateCrossProduct(order, angle);
  // v turns from u towards -Z, so the right-hand product u x v points along +Y.
  const vx = Math.cos(radians) * LENGTH_V;
  const vz = -Math.sin(radians) * LENGTH_V;
  const normalY = metrics.signedNormalY;
  const forward = order === "uCrossV";

  const parallelogram = useMemo(
    () => [
      [
        { x: 0, y: 0, z: 0 },
        { x: LENGTH_U, y: 0, z: 0 },
        { x: LENGTH_U + vx, y: 0, z: vz },
        { x: vx, y: 0, z: vz },
      ],
    ],
    [vx, vz]
  );
  // The curl runs from the first factor to the second, the way the fingers of the right hand close.
  const arc = useMemo(() => {
    const points = Arr.map(
      createArcPoints(ARC_RADIUS, radians, GRAPH_ANGLE_ARC_SEGMENTS),
      (point) => [point.x, 0.01, -point.y] as const
    );
    return forward ? points : Arr.reverse(points);
  }, [forward, radians]);
  const headTurn = forward ? radians : 0;
  const headSpin = forward ? radians : -Math.PI;

  return (
    <group>
      <ParameterSweep {...sweep} value={angle} />
      <Facets
        color={colors.plane}
        edgeWidth={1.6}
        faces={parallelogram}
        opacity={0.22}
      />
      <ArrowHelper
        arrowSize={0.24}
        color={colors.curve}
        from={[0, 0, 0]}
        lineWidth={3.2}
        to={[LENGTH_U, 0, 0]}
      />
      <ArrowHelper
        arrowSize={0.24}
        color={colors.slope}
        from={[0, 0, 0]}
        lineWidth={3.2}
        to={[vx, 0, vz]}
      />
      {Math.abs(normalY) > VISIBLE ? (
        <ArrowHelper
          arrowSize={0.26}
          color={colors.normal}
          from={[0, 0, 0]}
          lineWidth={3.6}
          to={[0, normalY, 0]}
        />
      ) : null}
      {radians > VISIBLE ? (
        <>
          <Line color={colors.accent} lineWidth={2.6} points={arc} />
          <mesh
            position={[
              Math.cos(headTurn) * ARC_RADIUS,
              0.01,
              -Math.sin(headTurn) * ARC_RADIUS,
            ]}
            rotation={[Math.PI / 2, 0, headSpin - Math.PI / 2, "YXZ"]}
          >
            <coneGeometry
              args={[ARC_HEAD / 2.6, ARC_HEAD, GRAPH_ARROW_SEGMENTS, 1]}
            />
            <meshBasicMaterial color={colors.accent} toneMapped={false} />
          </mesh>
        </>
      ) : null}
      <GraphTag
        anchorX="center"
        anchorY="top"
        color={colors.curve}
        gap={0.36}
        math="\vec{u}"
        name={parts.vectorU}
        position={[LENGTH_U, 0, 0]}
      />
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.slope}
        gap={0.1}
        math="\vec{v}"
        name={parts.vectorV}
        position={[vx, 0, vz]}
      />
      {Math.abs(normalY) > VISIBLE ? (
        <GraphTag
          anchorX="left"
          anchorY="middle"
          color={colors.normal}
          gap={0.16}
          math={`${forward ? "\\vec{u} \\times \\vec{v}" : "\\vec{v} \\times \\vec{u}"},\\ ${quantity(metrics.area, "", 2)}`}
          name={parts.crossVector}
          position={[0, normalY, 0]}
        />
      ) : null}
      <GraphTag
        anchorX="left"
        anchorY="middle"
        color={colors.plane}
        gap={0.14}
        math={`A = ${quantity(metrics.area, "", 2)}`}
        name={parts.parallelogram}
        position={[LENGTH_U + vx, 0, vz]}
      />
      {/* Inside the parallelogram, past the arc, where no edge or arrow crosses it */}
      <GraphTag
        anchorX="center"
        anchorY="middle"
        color={colors.accent}
        gap={0}
        math={`\\theta = ${quantity(angle, "^\\circ", 0)}`}
        name={parts.curlArc}
        position={[
          Math.cos(radians / 2) * ARC_RADIUS * TAG_REACH,
          0,
          -Math.sin(radians / 2) * ARC_RADIUS * TAG_REACH,
        ]}
      />
    </group>
  );
}
