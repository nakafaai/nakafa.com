import { Line } from "@react-three/drei";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import { evaluateDotProjection } from "@repo/design-system/components/contents/mathematics/projection/model";
import { ParameterSweep } from "@repo/design-system/components/contents/mathematics/sweep";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import {
  createArcPoints,
  GRAPH_ANGLE_ARC_SEGMENTS,
} from "@repo/design-system/components/three/data/quality";
import { GraphTag } from "@repo/design-system/components/three/tag";
import { STROKE_DASH } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";

/** The lengths of the two vectors, as the lesson and the model fix them. */
const LENGTH_U = 1.5;
const LENGTH_V = 2;
const ARC_RADIUS = 0.42;
/** The side of the square that marks the right angle at the foot of the drop. */
const SQUARE = 0.14;
/** Below this length a projection or a drop has no direction left to draw. */
const VISIBLE = 0.04;

export function DotProductProjection3DScene({
  angle,
  parts,
  sweep,
}: {
  readonly angle: number;
  readonly parts: Readonly<
    Record<
      "angleArc" | "dropLine" | "projectionVector" | "vectorU" | "vectorV",
      string
    >
  >;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const radians = (angle * Math.PI) / 180;
  const reading = evaluateDotProjection(angle);
  const tipX = Math.cos(radians) * LENGTH_U;
  const tipY = Math.sin(radians) * LENGTH_U;
  const obtuse = reading.dotProduct < 0;
  const projectionColor = obtuse ? colors.alert : colors.accent;
  const arc = Arr.map(
    createArcPoints(ARC_RADIUS, radians, GRAPH_ANGLE_ARC_SEGMENTS),
    (point) => [point.x, point.y, 0.02] as const
  );
  // The square opens towards the origin, on the side of the foot the projection covers.
  const inward = obtuse ? SQUARE : -SQUARE;

  return (
    <group>
      <ParameterSweep {...sweep} value={angle} />
      <ArrowHelper
        arrowSize={0.22}
        color={colors.slope}
        from={[0, 0, 0]}
        lineWidth={3}
        to={[LENGTH_V, 0, 0]}
      />
      <ArrowHelper
        arrowSize={0.22}
        color={colors.curve}
        from={[0, 0, 0.02]}
        lineWidth={3}
        to={[tipX, tipY, 0.02]}
      />
      {Math.abs(tipX) > VISIBLE ? (
        <ArrowHelper
          arrowSize={0.2}
          color={projectionColor}
          from={[0, 0, 0.05]}
          lineWidth={4.2}
          to={[tipX, 0, 0.05]}
        />
      ) : null}
      {tipY > VISIBLE ? (
        <>
          <Line
            color={colors.normal}
            dashed
            dashSize={STROKE_DASH.dash}
            gapSize={STROKE_DASH.gap}
            lineWidth={2}
            points={[
              [tipX, tipY, 0.03],
              [tipX, 0, 0.03],
            ]}
          />
          <Line
            color={colors.normal}
            lineWidth={1.6}
            points={[
              [tipX + inward, 0, 0.03],
              [tipX + inward, SQUARE, 0.03],
              [tipX, SQUARE, 0.03],
            ]}
          />
        </>
      ) : null}
      <Line color={colors.plane} lineWidth={2.4} points={arc} />
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.slope}
        gap={0.1}
        math={`\\vec{v},\\ |\\vec{v}| = ${quantity(LENGTH_V, "", 1)}`}
        name={parts.vectorV}
        position={[LENGTH_V, 0, 0]}
      />
      <GraphTag
        anchorX={tipX >= 0 ? "left" : "right"}
        anchorY="bottom"
        color={colors.curve}
        gap={0.1}
        math={`\\vec{u},\\ |\\vec{u}| = ${quantity(LENGTH_U, "", 1)}`}
        name={parts.vectorU}
        position={[tipX, tipY, 0.02]}
      />
      <GraphTag
        anchorX="center"
        anchorY="top"
        color={projectionColor}
        gap={0.34}
        math={`\\operatorname{proj}_{\\vec{v}}\\vec{u} = ${quantity(reading.projectionLength, "", 2)}`}
        name={parts.projectionVector}
        position={[tipX / 2, 0, 0.05]}
      />
      {tipY > VISIBLE ? (
        <GraphTag
          anchorX={obtuse ? "right" : "left"}
          anchorY="middle"
          color={colors.normal}
          gap={0.12}
          math="\perp \vec{v}"
          name={parts.dropLine}
          position={[tipX, tipY / 2, 0.03]}
        />
      ) : null}
      <GraphTag
        anchorX={obtuse ? "left" : "right"}
        anchorY="top"
        color={colors.plane}
        gap={0.34}
        math={`\\theta = ${quantity(angle, "^\\circ", 0)}`}
        name={parts.angleArc}
        position={[0, 0, 0.02]}
      />
    </group>
  );
}
