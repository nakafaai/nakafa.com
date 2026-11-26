import { Line } from "@react-three/drei";
import type { CurvePair } from "@repo/design-system/components/contents/mathematics/enclose/model";
import { sampleCurvePair } from "@repo/design-system/components/contents/mathematics/enclose/model";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { Array as Arr } from "effect";
import { useMemo } from "react";

const CURVE_XS = Arr.makeBy(41, (i) => i * 0.05);

export function AreaBetweenCurvesScene({
  pair,
  parts,
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
  readonly upperBound: number;
}) {
  const bound = Math.min(2, Math.max(0.15, upperBound));
  const edge = sampleCurvePair(pair, bound);

  const upperPoints = useMemo(
    () =>
      Arr.map(CURVE_XS, (x) => ({
        x: x * 2,
        y: sampleCurvePair(pair, x).upper * 1.4,
        z: 0.04,
      })),
    [pair]
  );

  const lowerPoints = useMemo(
    () =>
      Arr.map(CURVE_XS, (x) => ({
        x: x * 2,
        y: sampleCurvePair(pair, x).lower * 1.4,
        z: 0.04,
      })),
    [pair]
  );

  const shadedVertices = useMemo(() => {
    const sampleCount = 20;
    const top = Arr.makeBy(sampleCount + 1, (i) => {
      const x = (i / sampleCount) * bound;
      return { x: x * 2, y: sampleCurvePair(pair, x).upper * 1.4, z: 0 };
    });
    const bottom = Arr.reverse(
      Arr.makeBy(sampleCount + 1, (i) => {
        const x = (i / sampleCount) * bound;
        return { x: x * 2, y: sampleCurvePair(pair, x).lower * 1.4, z: 0 };
      })
    );
    return [...top, ...bottom];
  }, [pair, bound]);

  return (
    <group>
      {/* Upper and lower smooth curves */}
      <LineEquation
        color={CALCULUS_COLORS.cobaltCurve}
        lineWidth={3}
        points={upperPoints}
        showPoints={false}
        smooth
      />
      <LineEquation
        color={CALCULUS_COLORS.emeraldSlope}
        lineWidth={3}
        points={lowerPoints}
        showPoints={false}
        smooth
      />
      {/* Shaded enclosed polygon */}
      <Polygon
        color={CALCULUS_COLORS.cyanPlane}
        opacity={0.32}
        vertices={shadedVertices}
      />
      {/* Active vertical strip at x = bound */}
      <Line
        color={CALCULUS_COLORS.amberAccent}
        lineWidth={4}
        points={[
          [bound * 2, edge.lower * 1.4, 0.08],
          [bound * 2, edge.upper * 1.4, 0.08],
        ]}
      />
      {/* Intersection pins */}
      <mesh position={[0, sampleCurvePair(pair, 0).lower * 1.4, 0.08]}>
        <sphereGeometry args={[0.09, 14, 14]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.roseAlert}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[4, sampleCurvePair(pair, 2).lower * 1.4, 0.08]}>
        <sphereGeometry args={[0.09, 14, 14]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.roseAlert}
          toneMapped={false}
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={CALCULUS_COLORS.cobaltCurve}
        fontSize="compact"
        position={[2.0, 2.35, 0.08]}
      >
        <span>{parts.upperCurve}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.emeraldSlope}
        fontSize="compact"
        position={[2.0, 0.12, 0.08]}
      >
        <span>{parts.lowerCurve}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.cyanPlane}
        fontSize="compact"
        position={[bound, 1.15, 0.1]}
      >
        <span>{parts.shadedRibbon}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.amberAccent}
        fontSize="compact"
        position={[bound * 2 + 0.25, edge.upper * 1.4 + 0.25, 0.1]}
      >
        <span>{parts.verticalStrip}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.roseAlert}
        fontSize="compact"
        position={[-0.25, 0.55, 0.1]}
      >
        <span>{parts.intersectionPins}</span>
      </ThreeLabel>
    </group>
  );
}
