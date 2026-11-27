import { Line } from "@react-three/drei";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import type { SlopeCurve } from "@repo/design-system/components/contents/mathematics/slope/model";
import { evaluateSlopeField } from "@repo/design-system/components/contents/mathematics/slope/model";
import { ParameterSweep } from "@repo/design-system/components/contents/mathematics/sweep";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { LineEquation } from "@repo/design-system/components/three/line";
import { GraphMarker } from "@repo/design-system/components/three/marker";
import { GraphTag } from "@repo/design-system/components/three/tag";
import { STROKE_DASH } from "@repo/design-system/lib/plot";
import { Array as Arr, Option } from "effect";
import type { ComponentProps } from "react";
import { useMemo } from "react";

/** The window of the plane the lab frames. */
const VIEW = { bottom: -1.6, left: -2.2, right: 2.2, top: 2.8 };
/** The height the probe's reading stands at, under every curve the view keeps, at the foot of the probe's dashed line. */
const READOUT_Y = VIEW.bottom - 0.1;
const SAMPLES = 220;
/** Where a short needle shows the local slope of the function. */
const NEEDLE_XS = Arr.makeBy(11, (i) => -2 + i * 0.4);
const NEEDLE_LENGTH = 0.24;
const TANGENT_LENGTH = 0.7;

/** Half of a segment of a given length along a slope, as its run and its rise. */
function along(slope: number, length: number) {
  const run = length / Math.hypot(1, slope);
  return { rise: run * slope, run };
}

export function DerivativeSlopeFieldScene({
  curve,
  parts,
  probeX,
  sweep,
}: {
  readonly curve: SlopeCurve;
  readonly parts: Readonly<
    Record<
      | "criticalPoints"
      | "derivativeCurve"
      | "functionCurve"
      | "probeMarker"
      | "slopeNeedles",
      string
    >
  >;
  readonly probeX: number;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const probe = evaluateSlopeField(curve, probeX);

  const samples = useMemo(
    () =>
      Arr.makeBy(SAMPLES + 1, (i) => {
        const x = VIEW.left + (i / SAMPLES) * (VIEW.right - VIEW.left);
        return { x, ...evaluateSlopeField(curve, x) };
      }),
    [curve]
  );
  const inside = (y: number) => y >= VIEW.bottom && y <= VIEW.top;
  const functionPoints = Arr.filter(
    Arr.map(samples, ({ value, x }) => ({ x, y: value, z: 0.02 })),
    (point) => inside(point.y)
  );
  const derivativePoints = Arr.filter(
    Arr.map(samples, ({ derivative, x }) => ({ x, y: derivative, z: 0 })),
    (point) => inside(point.y)
  );
  // A stationary point stands where the derivative changes sign between two samples.
  const critical = Arr.map(
    Arr.filter(
      Arr.zip(samples, Arr.drop(samples, 1)),
      ([one, two]) =>
        one.derivative === 0 || one.derivative * two.derivative < 0
    ),
    ([one]) => one
  );
  const tangent = along(probe.derivative, TANGENT_LENGTH);
  const functionEnd = Arr.last(functionPoints);
  const derivativeEnd = Arr.last(derivativePoints);
  const firstCritical = Arr.head(critical);
  const lastNeedleX = Arr.lastNonEmpty(Arr.prepend(NEEDLE_XS, VIEW.right));
  const lastNeedle = evaluateSlopeField(curve, lastNeedleX);
  // The curve that ends higher takes the label above its end, the other the one below.
  const functionAbove =
    Option.getOrElse(
      Option.map(functionEnd, (point) => point.y),
      () => 0
    ) >=
    Option.getOrElse(
      Option.map(derivativeEnd, (point) => point.y),
      () => 0
    );

  return (
    <group>
      <ParameterSweep {...sweep} value={probeX} />
      <LineEquation
        color={colors.slope}
        lineWidth={2.4}
        points={derivativePoints}
        showPoints={false}
      />
      <LineEquation
        color={colors.curve}
        lineWidth={3.2}
        points={functionPoints}
        showPoints={false}
      />
      {Arr.map(NEEDLE_XS, (x) => {
        const point = evaluateSlopeField(curve, x);
        const needle = along(point.derivative, NEEDLE_LENGTH);
        return (
          <Line
            color={colors.accent}
            key={x}
            lineWidth={2.4}
            points={[
              [x - needle.run, point.value - needle.rise, 0.04],
              [x + needle.run, point.value + needle.rise, 0.04],
            ]}
          />
        );
      })}
      {Arr.map(critical, (point) => (
        <GraphMarker
          color={colors.alert}
          key={point.x}
          position={[point.x, point.value, 0.06]}
          radius={0.065}
        />
      ))}
      {/* The probe: its tangent on f, and the same x read off the derivative curve */}
      <Line
        color={colors.normal}
        dashed
        dashSize={STROKE_DASH.dash}
        gapSize={STROKE_DASH.gap}
        lineWidth={1.8}
        points={[
          [probeX, probe.value, 0.03],
          [probeX, Math.min(probe.derivative, READOUT_Y), 0.03],
        ]}
      />
      <Line
        color={colors.accent}
        lineWidth={3.4}
        points={[
          [probeX - tangent.run, probe.value - tangent.rise, 0.06],
          [probeX + tangent.run, probe.value + tangent.rise, 0.06],
        ]}
      />
      <GraphMarker
        color={colors.accent}
        position={[probeX, probe.value, 0.1]}
        radius={0.085}
      />
      <GraphMarker
        color={colors.slope}
        position={[probeX, probe.derivative, 0.1]}
        radius={0.07}
      />
      {Option.isSome(functionEnd) ? (
        <GraphTag
          anchorX="left"
          anchorY={functionAbove ? "bottom" : "top"}
          color={colors.curve}
          math="y = f(x)"
          name={parts.functionCurve}
          position={[functionEnd.value.x, functionEnd.value.y, 0]}
        />
      ) : null}
      {Option.isSome(derivativeEnd) ? (
        <GraphTag
          anchorX="left"
          anchorY={functionAbove ? "top" : "bottom"}
          color={colors.slope}
          math="y = f'(x)"
          name={parts.derivativeCurve}
          position={[derivativeEnd.value.x, derivativeEnd.value.y, 0]}
        />
      ) : null}
      <GraphTag
        anchorX={probeX > 0.8 ? "right" : "left"}
        anchorY="top"
        color={colors.accent}
        gap={0.08}
        math={`f'(${quantity(probeX, "", 2)}) = ${quantity(probe.derivative, "", 2)}`}
        name={parts.probeMarker}
        position={[probeX, READOUT_Y, 0.12]}
      />
      {Option.isSome(firstCritical) ? (
        <GraphTag
          anchorX="center"
          anchorY="bottom"
          color={colors.alert}
          gap={0.46}
          math="f'(x) = 0"
          name={parts.criticalPoints}
          position={[firstCritical.value.x, firstCritical.value.value, 0.1]}
        />
      ) : null}
      <GraphTag
        anchorX="left"
        anchorY="top"
        color={colors.accent}
        gap={0.14}
        math="m = f'(x)"
        name={parts.slopeNeedles}
        position={[lastNeedleX, lastNeedle.value, 0.1]}
      />
    </group>
  );
}
