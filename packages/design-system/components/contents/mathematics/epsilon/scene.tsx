import { Line } from "@react-three/drei";
import type { EpsilonFunction } from "@repo/design-system/components/contents/mathematics/epsilon/model";
import { evaluateEpsilonDelta } from "@repo/design-system/components/contents/mathematics/epsilon/model";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
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
const VIEW = { bottom: -0.6, left: -2.4, right: 2.4, top: 2.8 };
const SAMPLES = 160;

/** The value of each test function, as its formula in the lesson writes it. */
function sampleFn(fn: EpsilonFunction, x: number): number {
  if (fn === "removableHole") {
    return x + 1;
  }
  if (fn === "quadraticSmooth") {
    return x * x + 2 * x + 1;
  }
  return 2.5 * x + 1;
}

export function EpsilonDeltaBandScene({
  epsilon,
  fn,
  parts,
  sweep,
}: {
  readonly epsilon: number;
  readonly fn: EpsilonFunction;
  readonly parts: Readonly<
    Record<
      "curvePath" | "deltaBand" | "epsilonBand" | "holePoint" | "limitTarget",
      string
    >
  >;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const bound = evaluateEpsilonDelta(fn, epsilon);
  const { delta, limitL, targetA } = bound;

  const curve = useMemo(
    () =>
      Arr.filter(
        Arr.makeBy(SAMPLES + 1, (i) => {
          const x = VIEW.left + (i / SAMPLES) * (VIEW.right - VIEW.left);
          return { x, y: sampleFn(fn, x), z: 0 };
        }),
        (point) => point.y >= VIEW.bottom && point.y <= VIEW.top
      ),
    [fn]
  );

  const topEnd = Arr.reduce(curve, { x: 0, y: limitL, z: 0 }, (top, point) =>
    point.y > top.y ? point : top
  );

  const epsilonBand = useMemo(
    () => [
      { x: VIEW.left, y: limitL - epsilon, z: -0.02 },
      { x: VIEW.right, y: limitL - epsilon, z: -0.02 },
      { x: VIEW.right, y: limitL + epsilon, z: -0.02 },
      { x: VIEW.left, y: limitL + epsilon, z: -0.02 },
    ],
    [epsilon, limitL]
  );

  const deltaBand = useMemo(
    () => [
      { x: targetA - delta, y: VIEW.bottom, z: -0.01 },
      { x: targetA + delta, y: VIEW.bottom, z: -0.01 },
      { x: targetA + delta, y: VIEW.top, z: -0.01 },
      { x: targetA - delta, y: VIEW.top, z: -0.01 },
    ],
    [delta, targetA]
  );

  return (
    <group>
      <ParameterSweep {...sweep} value={epsilon} />
      {/* Output corridor L - epsilon < y < L + epsilon, with its two strict edges */}
      <Polygon color={colors.slope} opacity={0.14} vertices={epsilonBand} />
      {Arr.map([limitL - epsilon, limitL + epsilon], (y) => (
        <Line
          color={colors.slope}
          dashed
          dashSize={STROKE_DASH.dash}
          gapSize={STROKE_DASH.gap}
          key={y}
          lineWidth={1.6}
          points={[
            [VIEW.left, y, 0],
            [VIEW.right, y, 0],
          ]}
        />
      ))}
      {/* Input corridor a - delta < x < a + delta */}
      <Polygon color={colors.plane} opacity={0.16} vertices={deltaBand} />
      {Arr.map([targetA - delta, targetA + delta], (x) => (
        <Line
          color={colors.plane}
          dashed
          dashSize={STROKE_DASH.dash}
          gapSize={STROKE_DASH.gap}
          key={x}
          lineWidth={1.6}
          points={[
            [x, VIEW.bottom, 0],
            [x, VIEW.top, 0],
          ]}
        />
      ))}
      {/* Target height y = L */}
      <Line
        color={colors.guide}
        lineWidth={1.4}
        points={[
          [VIEW.left, limitL, 0.01],
          [VIEW.right, limitL, 0.01],
        ]}
      />
      <LineEquation
        color={colors.curve}
        lineWidth={3.2}
        points={curve}
        showPoints={false}
      />
      {/* The limit point: open where the function has a hole, filled where it is defined */}
      <GraphMarker
        color={colors.alert}
        hollow={fn === "removableHole"}
        position={[targetA, limitL, 0.06]}
        radius={0.085}
      />
      <GraphTag
        anchorX="right"
        anchorY="top"
        color={colors.slope}
        math={`|f(x) - L| < ${quantity(epsilon, "", 2)}`}
        name={parts.epsilonBand}
        position={[VIEW.right, limitL - epsilon, 0]}
      />
      <GraphTag
        anchorX="left"
        anchorY="top"
        color={colors.guide}
        math={`L = ${quantity(limitL, "", 1)}`}
        name={parts.limitTarget}
        position={[VIEW.left, limitL - epsilon, 0]}
      />
      <GraphTag
        anchorX="left"
        anchorY="top"
        color={colors.plane}
        math={`|x - a| < ${quantity(delta, "", 2)}`}
        name={parts.deltaBand}
        position={[targetA + delta, VIEW.bottom, 0]}
      />
      <GraphTag
        anchorX="right"
        anchorY="bottom"
        color={colors.alert}
        math={`(${quantity(targetA, "", 1)},\\ ${quantity(limitL, "", 1)})`}
        name={parts.holePoint}
        position={[targetA - delta, limitL + epsilon, 0.08]}
      />
      <GraphTag
        anchorX="left"
        anchorY="top"
        color={colors.curve}
        math="y = f(x)"
        name={parts.curvePath}
        position={[topEnd.x, topEnd.y, 0]}
      />
    </group>
  );
}
