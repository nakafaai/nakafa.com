import { Line } from "@react-three/drei";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import type { SqueezeEnvelope } from "@repo/design-system/components/contents/mathematics/squeeze/model";
import { evaluateSqueezeTheorem } from "@repo/design-system/components/contents/mathematics/squeeze/model";
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
const VIEW = { x: 2.2, y: 1.8 };
/** Samples on each side of zero, spaced closer the nearer they stand to it, where the wave turns fastest. */
const SAMPLES = 900;

/** The two bounds and the function between them, as the lesson's inequality writes them. */
function sampleBounds(envelope: SqueezeEnvelope, x: number) {
  if (envelope === "quadraticSine") {
    return { lower: -x * x, mid: x * x * Math.sin(1 / x), upper: x * x };
  }
  if (envelope === "linearDamped") {
    const reach = Math.abs(x);
    return { lower: -reach, mid: reach * Math.cos(1 / x), upper: reach };
  }
  return { lower: Math.cos(x), mid: Math.sin(x) / x, upper: 1 };
}

/** The KaTeX name of each bound and of the function between them. */
const EQUATIONS = {
  linearDamped: {
    lowerMath: "y = -|x|",
    midMath: "y = |x|\\cos\\frac{1}{x}",
    upperMath: "y = |x|",
  },
  quadraticSine: {
    lowerMath: "y = -x^2",
    midMath: "y = x^2\\sin\\frac{1}{x}",
    upperMath: "y = x^2",
  },
  sincEnvelope: {
    lowerMath: "y = \\cos x",
    midMath: "y = \\frac{\\sin x}{x}",
    upperMath: "y = 1",
  },
} as const;

/** Every sample of one side of zero that stays inside the window, from the far edge inwards. */
function sampleSide(envelope: SqueezeEnvelope, side: -1 | 1) {
  return Arr.filter(
    Arr.makeBy(SAMPLES, (i) => {
      const x = side * VIEW.x * (1 - i / SAMPLES) ** 2;
      return { x, ...sampleBounds(envelope, x) };
    }),
    (point) =>
      Math.abs(point.upper) <= VIEW.y && Math.abs(point.lower) <= VIEW.y
  );
}

export function SqueezeTheoremWaveScene({
  envelope,
  parts,
  radius,
  sweep,
}: {
  readonly envelope: SqueezeEnvelope;
  readonly parts: Readonly<
    Record<
      | "lowerBound"
      | "pinchPoint"
      | "squeezedWave"
      | "upperBound"
      | "windowFrame",
      string
    >
  >;
  readonly radius: number;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const pinchY = evaluateSqueezeTheorem(envelope, radius).limitValue;
  const equations = EQUATIONS[envelope];

  const curves = useMemo(() => {
    // One pass from the left edge through zero to the right edge; zero itself is the open point.
    const samples = [
      ...sampleSide(envelope, -1),
      ...Arr.reverse(sampleSide(envelope, 1)),
    ];
    return {
      lower: Arr.map(samples, ({ lower, x }) => ({ x, y: lower, z: 0 })),
      mid: Arr.map(samples, ({ mid, x }) => ({ x, y: mid, z: 0.03 })),
      upper: Arr.map(samples, ({ upper, x }) => ({ x, y: upper, z: 0 })),
    };
  }, [envelope]);

  const windowQuad = useMemo(
    () => [
      { x: -radius, y: -VIEW.y, z: -0.02 },
      { x: radius, y: -VIEW.y, z: -0.02 },
      { x: radius, y: VIEW.y, z: -0.02 },
      { x: -radius, y: VIEW.y, z: -0.02 },
    ],
    [radius]
  );
  const pinch = { x: 0, y: pinchY, z: 0 };
  const rightEnd = Arr.lastNonEmpty(Arr.appendAll([pinch], curves.upper));
  const rightMid = Arr.lastNonEmpty(Arr.appendAll([pinch], curves.mid));
  const rightLower = Arr.lastNonEmpty(Arr.appendAll([pinch], curves.lower));

  return (
    <group>
      <ParameterSweep {...sweep} value={radius} />
      {/* The window |x| < r that shrinks onto the limit */}
      <Polygon color={colors.plane} opacity={0.14} vertices={windowQuad} />
      {Arr.map([-radius, radius], (x) => (
        <Line
          color={colors.plane}
          dashed
          dashSize={STROKE_DASH.dash}
          gapSize={STROKE_DASH.gap}
          key={x}
          lineWidth={1.6}
          points={[
            [x, -VIEW.y, 0],
            [x, VIEW.y, 0],
          ]}
        />
      ))}
      <LineEquation
        color={colors.slope}
        lineWidth={2.4}
        points={curves.upper}
        showPoints={false}
      />
      <LineEquation
        color={colors.envelope}
        lineWidth={2.4}
        points={curves.lower}
        showPoints={false}
      />
      <LineEquation
        color={colors.curve}
        lineWidth={3}
        points={curves.mid}
        showPoints={false}
      />
      {/* None of the three squeezed functions is defined at zero, so the limit point is open */}
      <GraphMarker
        color={colors.alert}
        hollow
        position={[0, pinchY, 0.08]}
        radius={0.085}
      />
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.slope}
        math={equations.upperMath}
        name={parts.upperBound}
        position={[rightEnd.x, rightEnd.y, 0]}
      />
      <GraphTag
        anchorX="left"
        anchorY="middle"
        color={colors.curve}
        math={equations.midMath}
        name={parts.squeezedWave}
        position={[rightMid.x, rightMid.y, 0.05]}
      />
      <GraphTag
        anchorX="left"
        anchorY="top"
        color={colors.envelope}
        math={equations.lowerMath}
        name={parts.lowerBound}
        position={[rightLower.x, rightLower.y, 0]}
      />
      <GraphTag
        anchorX="right"
        anchorY="bottom"
        color={colors.alert}
        gap={0.14}
        math={`(0,\\ ${quantity(pinchY, "", 0)})`}
        name={parts.pinchPoint}
        position={[0, pinchY, 0.1]}
      />
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.plane}
        math={`|x| < ${quantity(radius, "", 2)}`}
        name={parts.windowFrame}
        position={[radius, -VIEW.y, 0]}
      />
    </group>
  );
}
