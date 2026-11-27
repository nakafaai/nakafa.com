import { Line } from "@react-three/drei";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import type { SecantCurve } from "@repo/design-system/components/contents/mathematics/secant/model";
import {
  evaluateSecantLimit,
  sampleSecantCurve,
} from "@repo/design-system/components/contents/mathematics/secant/model";
import { ParameterSweep } from "@repo/design-system/components/contents/mathematics/sweep";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { LineEquation } from "@repo/design-system/components/three/line";
import { GraphMarker } from "@repo/design-system/components/three/marker";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { GraphTag } from "@repo/design-system/components/three/tag";
import { STROKE_DASH } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useMemo } from "react";

/** The window of the plane the lab frames. */
const VIEW = { bottom: -0.5, left: -1.6, right: 3.2, top: 3.1 };
const SAMPLES = 200;
/** The fixed point the secant turns about, as the model sets it. */
const ANCHOR_X = 0.5;

/** The two ends of the line through a point with a slope, cut to the window. */
function clipLine(x: number, y: number, slope: number, z: number) {
  const flat = Math.abs(slope) < 1e-6;
  const atBottom = flat ? VIEW.left : x + (VIEW.bottom - y) / slope;
  const atTop = flat ? VIEW.right : x + (VIEW.top - y) / slope;
  const start = Math.max(VIEW.left, Math.min(atBottom, atTop));
  const end = Math.min(VIEW.right, Math.max(atBottom, atTop));
  return [
    { x: start, y: y + (start - x) * slope, z },
    { x: end, y: y + (end - x) * slope, z },
  ] as const;
}

export function SecantToTangentScene({
  curve,
  parts,
  stepH,
  sweep,
}: {
  readonly curve: SecantCurve;
  readonly parts: Readonly<
    Record<
      | "anchorPoint"
      | "curveRibbon"
      | "movingPoint"
      | "secantLine"
      | "slopeTriangle"
      | "tangentLine",
      string
    >
  >;
  readonly stepH: number;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const metrics = evaluateSecantLimit(curve, stepH);
  const { anchorY, movingY, secantSlope, tangentSlope } = metrics;
  const movingX = ANCHOR_X + stepH;

  const curvePoints = useMemo(
    () =>
      Arr.filter(
        Arr.makeBy(SAMPLES + 1, (i) => {
          const x = VIEW.left + (i / SAMPLES) * (VIEW.right - VIEW.left);
          return { x, y: sampleSecantCurve(curve, x), z: 0 };
        }),
        (point) => point.y >= VIEW.bottom && point.y <= VIEW.top
      ),
    [curve]
  );
  const secant = clipLine(ANCHOR_X, anchorY, secantSlope, 0.03);
  const tangent = clipLine(ANCHOR_X, anchorY, tangentSlope, 0.02);
  const triangle = useMemo(
    () => [
      { x: ANCHOR_X, y: anchorY, z: 0.01 },
      { x: movingX, y: anchorY, z: 0.01 },
      { x: movingX, y: movingY, z: 0.01 },
    ],
    [anchorY, movingX, movingY]
  );
  // Right of the anchor the steeper line runs higher, so each label takes its own side.
  const secantAbove = secantSlope >= tangentSlope;
  const curveEnd = Arr.lastNonEmpty(
    Arr.appendAll([{ x: ANCHOR_X, y: anchorY, z: 0 }], curvePoints)
  );

  return (
    <group>
      <ParameterSweep {...sweep} descending value={stepH} />
      <LineEquation
        color={colors.curve}
        lineWidth={3.2}
        points={curvePoints}
        showPoints={false}
      />
      {/* Slope triangle: the run h and the rise f(a + h) - f(a) */}
      <Polygon color={colors.normal} opacity={0.14} vertices={triangle} />
      <Line
        color={colors.normal}
        lineWidth={2}
        points={[
          [ANCHOR_X, anchorY, 0.02],
          [movingX, anchorY, 0.02],
          [movingX, movingY, 0.02],
        ]}
      />
      <Line
        color={colors.slope}
        dashed
        dashSize={STROKE_DASH.dash}
        gapSize={STROKE_DASH.gap}
        lineWidth={2.2}
        points={Arr.map(tangent, ({ x, y, z }) => [x, y, z] as const)}
      />
      <Line
        color={colors.accent}
        lineWidth={2.6}
        points={Arr.map(secant, ({ x, y, z }) => [x, y, z] as const)}
      />
      <GraphMarker
        color={colors.slope}
        position={[ANCHOR_X, anchorY, 0.08]}
        radius={0.08}
      />
      <GraphMarker
        color={colors.accent}
        position={[movingX, movingY, 0.08]}
        radius={0.08}
      />
      <GraphTag
        anchorX="left"
        anchorY={secantAbove ? "bottom" : "top"}
        color={colors.accent}
        math={`m_{\\sec} = ${quantity(secantSlope, "", 2)}`}
        name={parts.secantLine}
        position={[secant[1].x, secant[1].y, 0]}
      />
      <GraphTag
        anchorX="left"
        anchorY={secantAbove ? "top" : "bottom"}
        color={colors.slope}
        math={`f'(a) = ${quantity(tangentSlope, "", 2)}`}
        name={parts.tangentLine}
        position={[tangent[1].x, tangent[1].y, 0]}
      />
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.curve}
        math="y = f(x)"
        name={parts.curveRibbon}
        position={[curveEnd.x, curveEnd.y, 0]}
      />
      <GraphTag
        anchorX="right"
        anchorY="bottom"
        color={colors.slope}
        gap={0.14}
        math="A"
        name={parts.anchorPoint}
        position={[ANCHOR_X, anchorY, 0.1]}
      />
      <GraphTag
        anchorX="right"
        anchorY="bottom"
        color={colors.accent}
        gap={0.14}
        math="B"
        name={parts.movingPoint}
        position={[movingX, movingY, 0.1]}
      />
      {/* Under the axis, where the step is read off, clear of the tick marks */}
      <GraphTag
        anchorX="left"
        anchorY="top"
        color={colors.normal}
        gap={0.34}
        math={`h = ${quantity(stepH, "", 2)}`}
        position={[movingX, Math.min(anchorY, 0), 0.05]}
      />
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.normal}
        math="f(a + h) - f(a)"
        name={parts.slopeTriangle}
        position={[movingX, anchorY, 0.05]}
      />
    </group>
  );
}
