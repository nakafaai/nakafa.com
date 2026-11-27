import { Line } from "@react-three/drei";
import type { CurvePair } from "@repo/design-system/components/contents/mathematics/enclose/model";
import {
  evaluateAreaBetweenCurves,
  sampleCurvePair,
} from "@repo/design-system/components/contents/mathematics/enclose/model";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import { ParameterSweep } from "@repo/design-system/components/contents/mathematics/sweep";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { LineEquation } from "@repo/design-system/components/three/line";
import { GraphMarker } from "@repo/design-system/components/three/marker";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { GraphTag } from "@repo/design-system/components/three/tag";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useMemo } from "react";

/**
 * World units of one mathematical unit on each axis. The lab passes the same
 * scale to its coordinate system, so every tick reads the true value.
 */
export const ENCLOSE_SCALE = { x: 2, y: 1.4, z: 1 } as const;
/** The interval both curves are drawn on. */
const DOMAIN = { max: 2, min: 0 };
const SAMPLES = 160;
/** How close two curves stand, in mathematical units, to count as meeting. */
const MEETING = 0.01;

/** A point of the plane in world units, from its mathematical coordinates. */
function place(x: number, y: number, z: number) {
  return { x: x * ENCLOSE_SCALE.x, y: y * ENCLOSE_SCALE.y, z };
}

export function AreaBetweenCurvesScene({
  pair,
  parts,
  sweep,
  upperBound,
}: {
  readonly pair: CurvePair;
  readonly parts: Readonly<
    Record<
      | "intersectionPins"
      | "lowerCurve"
      | "shadedRibbon"
      | "upperCurve"
      | "verticalStrip",
      string
    >
  >;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
  readonly upperBound: number;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const bound = Math.min(DOMAIN.max, Math.max(DOMAIN.min, upperBound));
  const edge = sampleCurvePair(pair, bound);
  const metrics = evaluateAreaBetweenCurves(pair, bound);

  const curves = useMemo(() => {
    const samples = Arr.makeBy(SAMPLES + 1, (i) => {
      const x = DOMAIN.min + (i / SAMPLES) * (DOMAIN.max - DOMAIN.min);
      return { x, ...sampleCurvePair(pair, x) };
    });
    return {
      lower: Arr.map(samples, ({ lower, x }) => place(x, lower, 0.02)),
      upper: Arr.map(samples, ({ upper, x }) => place(x, upper, 0.02)),
    };
  }, [pair]);

  const shaded = useMemo(() => {
    const samples = Arr.makeBy(SAMPLES + 1, (i) => {
      const x = DOMAIN.min + (i / SAMPLES) * (bound - DOMAIN.min);
      return { x, ...sampleCurvePair(pair, x) };
    });
    return [
      ...Arr.map(samples, ({ upper, x }) => place(x, upper, 0)),
      ...Arr.reverse(Arr.map(samples, ({ lower, x }) => place(x, lower, 0))),
    ];
  }, [bound, pair]);

  // Only the ends where the two curves truly meet carry a pin.
  const pins = Arr.filter(
    Arr.map([DOMAIN.min, DOMAIN.max], (x) => ({
      x,
      ...sampleCurvePair(pair, x),
    })),
    (end) => Math.abs(end.upper - end.lower) < MEETING
  );
  const start = sampleCurvePair(pair, DOMAIN.min);
  const end = sampleCurvePair(pair, DOMAIN.max);
  const middle = sampleCurvePair(pair, bound / 2);
  const top = place(bound, edge.upper, 0.06);
  const bottom = place(bound, edge.lower, 0.06);
  const upperEnd = place(DOMAIN.max, end.upper, 0);
  const lowerEnd = place(DOMAIN.max, end.lower, 0);
  const centre = place(bound / 2, middle.upper, 0.04);
  const firstPin = place(DOMAIN.min, start.lower, 0.1);

  return (
    <group>
      <ParameterSweep {...sweep} value={upperBound} />
      <Polygon color={colors.plane} opacity={0.22} vertices={shaded} />
      <LineEquation
        color={colors.curve}
        lineWidth={3.2}
        points={curves.upper}
        showPoints={false}
      />
      <LineEquation
        color={colors.slope}
        lineWidth={3.2}
        points={curves.lower}
        showPoints={false}
      />
      {/* The strip f(b) - g(b) at the moving bound */}
      <Line
        color={colors.accent}
        lineWidth={3.4}
        points={[
          [bottom.x, bottom.y, bottom.z],
          [top.x, top.y, top.z],
        ]}
      />
      <GraphMarker
        color={colors.accent}
        position={[top.x, top.y, 0.08]}
        radius={0.06}
      />
      <GraphMarker
        color={colors.accent}
        position={[bottom.x, bottom.y, 0.08]}
        radius={0.06}
      />
      {Arr.map(pins, (pin) => {
        const point = place(pin.x, pin.lower, 0.08);
        return (
          <GraphMarker
            color={colors.alert}
            key={pin.x}
            position={[point.x, point.y, point.z]}
            radius={0.075}
          />
        );
      })}
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.curve}
        math="y = f(x)"
        name={parts.upperCurve}
        position={[upperEnd.x, upperEnd.y, 0]}
      />
      <GraphTag
        anchorX="left"
        anchorY="top"
        color={colors.slope}
        math="y = g(x)"
        name={parts.lowerCurve}
        position={[lowerEnd.x, lowerEnd.y, 0]}
      />
      <GraphTag
        anchorX="right"
        anchorY="bottom"
        color={colors.plane}
        gap={0.12}
        math={`A = ${quantity(metrics.enclosedArea, "", 2)}`}
        name={parts.shadedRibbon}
        position={[centre.x, centre.y, centre.z]}
      />
      <GraphTag
        anchorX="right"
        anchorY="bottom"
        color={colors.accent}
        gap={0.12}
        math={`f - g = ${quantity(metrics.gapAtBound, "", 2)}`}
        name={parts.verticalStrip}
        position={[top.x, top.y, 0.1]}
      />
      {Arr.isReadonlyArrayNonEmpty(pins) ? (
        <GraphTag
          anchorX="left"
          anchorY="top"
          color={colors.alert}
          gap={0.36}
          math="f(x) = g(x)"
          name={parts.intersectionPins}
          position={[firstPin.x, 0, firstPin.z]}
        />
      ) : null}
    </group>
  );
}
