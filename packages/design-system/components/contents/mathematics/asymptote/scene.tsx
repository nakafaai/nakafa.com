import { Line } from "@react-three/drei";
import type { AsymptoteCurve } from "@repo/design-system/components/contents/mathematics/asymptote/model";
import { evaluateAsymptoteProbe } from "@repo/design-system/components/contents/mathematics/asymptote/model";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import { ParameterSweep } from "@repo/design-system/components/contents/mathematics/sweep";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { LineEquation } from "@repo/design-system/components/three/line";
import { GraphMarker } from "@repo/design-system/components/three/marker";
import { GraphTag } from "@repo/design-system/components/three/tag";
import { STROKE_DASH } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useMemo } from "react";

/** The window of the plane the lab frames. */
const VIEW = { x: 2.8, y: 2.7 };
/** Samples of one branch, spaced closer the nearer they stand to the pole. */
const SAMPLES = 180;
/** The nearest a probe may stand to the pole, where the model still reads a value. */
const POLE_CLEARANCE = 0.16;

/** The value of each curve, as its formula in the lesson writes it. */
function curveValue(curve: AsymptoteCurve, x: number): number {
  if (curve === "reciprocalPole") {
    return 0.45 / x;
  }
  if (curve === "rationalHorizontal") {
    return (0.8 * x + 0.35) / (x - 0.3);
  }
  return 0.45 * x + 0.3 / x;
}

/** The far-field asymptote of each curve: a height, or a slanted line through the origin. */
function farValue(curve: AsymptoteCurve, x: number): number {
  if (curve === "obliqueSlant") {
    return 0.45 * x;
  }
  return curve === "rationalHorizontal" ? 0.8 : 0;
}

/** One branch of the curve from the pole out to the window's edge, kept inside the window. */
function sampleBranch(curve: AsymptoteCurve, poleX: number, side: -1 | 1) {
  const reach = VIEW.x - side * poleX;
  return Arr.filter(
    Arr.makeBy(SAMPLES + 1, (i) => {
      const x = poleX + side * reach * (i / SAMPLES) ** 2;
      return { x, y: curveValue(curve, x), z: 0.02 };
    }),
    (point) => Number.isFinite(point.y) && Math.abs(point.y) <= VIEW.y
  );
}

export function AsymptoteBehaviorScene({
  curve,
  parts,
  probeX,
  sweep,
}: {
  readonly curve: AsymptoteCurve;
  readonly parts: Readonly<
    Record<
      | "curveBranches"
      | "horizontalAsymptote"
      | "leftProbe"
      | "rightProbe"
      | "verticalAsymptote",
      string
    >
  >;
  readonly probeX: number;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const poleX = evaluateAsymptoteProbe(curve, probeX).verticalX;

  const leftBranch = useMemo(
    () => sampleBranch(curve, poleX, -1),
    [curve, poleX]
  );
  const rightBranch = useMemo(
    () => sampleBranch(curve, poleX, 1),
    [curve, poleX]
  );

  // The slider's probe and its mirror image across the pole, each kept clear of the pole.
  const offset =
    Math.max(POLE_CLEARANCE, Math.abs(probeX - poleX)) *
    (probeX < poleX ? -1 : 1);
  const probes = Arr.map([offset, -offset], (distance, index) => {
    const x = poleX + distance;
    const y = curveValue(curve, x);
    return {
      active: index === 0,
      inside: Math.abs(y) <= VIEW.y && Math.abs(x) <= VIEW.x,
      name: distance > 0 ? parts.rightProbe : parts.leftProbe,
      right: distance > 0,
      x,
      y,
    };
  });
  const oblique = curve === "obliqueSlant";
  const farEquation = oblique
    ? `y = ${quantity(0.45, "", 2)}x`
    : `y = ${quantity(farValue(curve, 0), "", 2)}`;

  return (
    <group>
      <ParameterSweep {...sweep} value={probeX} />
      <Line
        color={colors.alert}
        dashed
        dashSize={STROKE_DASH.dash}
        gapSize={STROKE_DASH.gap}
        lineWidth={2.2}
        points={[
          [poleX, -VIEW.y, 0.01],
          [poleX, VIEW.y, 0.01],
        ]}
      />
      <Line
        color={colors.slope}
        dashed
        dashSize={STROKE_DASH.dash}
        gapSize={STROKE_DASH.gap}
        lineWidth={2.2}
        points={[
          [-VIEW.x, farValue(curve, -VIEW.x), 0.01],
          [VIEW.x, farValue(curve, VIEW.x), 0.01],
        ]}
      />
      <LineEquation
        color={colors.curve}
        lineWidth={3.2}
        points={leftBranch}
        showPoints={false}
      />
      <LineEquation
        color={colors.curve}
        lineWidth={3.2}
        points={rightBranch}
        showPoints={false}
      />
      {Arr.map(probes, (probe) =>
        probe.inside ? (
          <group key={probe.name}>
            <GraphMarker
              color={probe.active ? colors.accent : colors.normal}
              position={[probe.x, probe.y, 0.08]}
              radius={probe.active ? 0.085 : 0.07}
            />
            <GraphTag
              anchorX={probe.right ? "left" : "right"}
              anchorY={probe.right ? "bottom" : "top"}
              color={probe.active ? colors.accent : colors.normal}
              gap={0.12}
              math={`(${quantity(probe.x, "", 2)},\\ ${quantity(probe.y, "", 2)})`}
              name={probe.name}
              position={[probe.x, probe.y, 0.1]}
            />
          </group>
        ) : null
      )}
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.alert}
        math={`x = ${quantity(poleX, "", 1)}`}
        name={parts.verticalAsymptote}
        position={[poleX, -VIEW.y, 0]}
      />
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.slope}
        math={farEquation}
        name={parts.horizontalAsymptote}
        position={[-VIEW.x, farValue(curve, -VIEW.x), 0]}
      />
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.curve}
        math="y = f(x)"
        name={parts.curveBranches}
        position={[VIEW.x, curveValue(curve, VIEW.x), 0]}
      />
    </group>
  );
}
