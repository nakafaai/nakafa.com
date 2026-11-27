import { Line } from "@react-three/drei";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import type { QrStep } from "@repo/design-system/components/contents/mathematics/qr/model";
import { evaluateQrStep } from "@repo/design-system/components/contents/mathematics/qr/model";
import { ParameterSweep } from "@repo/design-system/components/contents/mathematics/sweep";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import {
  createArcPoints,
  GRAPH_FULL_CIRCLE_SEGMENTS,
} from "@repo/design-system/components/three/data/quality";
import { GraphTag } from "@repo/design-system/components/three/tag";
import { STROKE_DASH } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";

/**
 * World units of one mathematical unit. The lab passes the same scale to its
 * coordinate system, so the unit sphere meets every axis at the tick 1.
 */
export const QR_SCALE = { x: 1.8, y: 1.8, z: 1.8 } as const;
const UNIT = QR_SCALE.x;
/** The length of the first input column before it is normalized. */
const INPUT_LENGTH = 4 / 3;
/** The side of the square that marks a right angle between two orthogonal vectors. */
const SQUARE = 0.16 * UNIT;
/** The three great circles that draw the unit sphere without a surface. */
const CIRCLE = Arr.map(
  createArcPoints(UNIT, Math.PI * 2, GRAPH_FULL_CIRCLE_SEGMENTS),
  (point) => [point.x, point.y] as const
);
const GREAT_CIRCLES = [
  Arr.map(CIRCLE, ([a, b]) => [a, b, 0] as const),
  Arr.map(CIRCLE, ([a, b]) => [a, 0, b] as const),
  Arr.map(CIRCLE, ([a, b]) => [0, a, b] as const),
] as const;

export function QrGramSchmidt3DScene({
  parts,
  skew,
  step,
  sweep,
}: {
  readonly parts: Readonly<
    Record<
      | "inputVectors"
      | "orthogonalFrame"
      | "orthonormalBasis"
      | "projectionShadow"
      | "unitSphere",
      string
    >
  >;
  readonly skew: number;
  readonly step: QrStep;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const state = evaluateQrStep(step, skew);
  const normalized = step !== "originalBasis";
  const secondSkewed = state.q2TiltRad > 0;
  const thirdSkewed = state.q3TiltRad > 0;
  const first = [(normalized ? 1 : INPUT_LENGTH) * UNIT, 0, 0] as const;
  // The second column carries exactly r12 along q1, the entry the lab reads out.
  const second = secondSkewed
    ? ([state.r12 * UNIT, UNIT, 0] as const)
    : ([0, UNIT, 0] as const);
  const third = [
    Math.sin(state.q3TiltRad) * (2 / 3) * UNIT,
    Math.sin(state.q3TiltRad) * 0.5 * UNIT,
    Math.cos(state.q3TiltRad) * UNIT,
  ] as const;

  return (
    <group>
      <ParameterSweep {...sweep} value={skew} />
      {Arr.map(GREAT_CIRCLES, (circle, index) => (
        <Line
          color={colors.guide}
          // biome-ignore lint/suspicious/noArrayIndexKey: The three great circles are a fixed list.
          key={index}
          lineWidth={1.2}
          opacity={0.7}
          points={circle}
          transparent
        />
      ))}
      <ArrowHelper
        arrowSize={0.26}
        color={colors.curve}
        from={[0, 0, 0]}
        lineWidth={3.6}
        to={first}
      />
      <ArrowHelper
        arrowSize={0.26}
        color={colors.slope}
        from={[0, 0, 0]}
        lineWidth={3.6}
        to={second}
      />
      <ArrowHelper
        arrowSize={0.26}
        color={colors.normal}
        from={[0, 0, 0]}
        lineWidth={3.6}
        to={third}
      />
      {secondSkewed ? (
        <>
          {/* The shadow r12 q1 that the second step subtracts */}
          <ArrowHelper
            arrowSize={0.2}
            color={colors.accent}
            from={[0, 0.02, 0.02]}
            lineWidth={4.4}
            to={[state.r12 * UNIT, 0.02, 0.02]}
          />
          <Line
            color={colors.accent}
            dashed
            dashSize={STROKE_DASH.dash}
            gapSize={STROKE_DASH.gap}
            lineWidth={1.8}
            points={[second, [state.r12 * UNIT, 0, 0]]}
          />
          <GraphTag
            anchorX="center"
            anchorY="top"
            color={colors.accent}
            gap={0.5}
            math={`r_{12} = ${quantity(state.r12, "", 2)}`}
            name={parts.projectionShadow}
            position={[state.r12 * UNIT, 0, 0]}
          />
        </>
      ) : (
        <Line
          color={colors.plane}
          lineWidth={1.8}
          points={[
            [SQUARE, 0, 0],
            [SQUARE, SQUARE, 0],
            [0, SQUARE, 0],
          ]}
        />
      )}
      {thirdSkewed ? null : (
        <Line
          color={colors.plane}
          lineWidth={1.8}
          points={[
            [SQUARE, 0, 0],
            [SQUARE, 0, SQUARE],
            [0, 0, SQUARE],
            [0, SQUARE, SQUARE],
            [0, SQUARE, 0],
          ]}
        />
      )}
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.curve}
        gap={0.1}
        math={normalized ? "\\vec{q}_1" : "\\vec{a}_1"}
        name={normalized ? parts.orthonormalBasis : undefined}
        position={first}
      />
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.slope}
        gap={0.1}
        math={secondSkewed ? "\\vec{a}_2" : "\\vec{q}_2"}
        name={secondSkewed ? parts.inputVectors : undefined}
        position={second}
      />
      <GraphTag
        anchorX="right"
        anchorY="top"
        color={colors.normal}
        gap={0.12}
        math={thirdSkewed ? "\\vec{a}_3" : "\\vec{q}_3"}
        name={thirdSkewed ? undefined : parts.orthogonalFrame}
        position={third}
      />
      <GraphTag
        anchorX="right"
        anchorY="bottom"
        color={colors.guide}
        gap={0.08}
        math="\|\vec{q}\| = 1"
        name={parts.unitSphere}
        position={[-UNIT * Math.SQRT1_2, UNIT * Math.SQRT1_2, 0]}
      />
    </group>
  );
}
