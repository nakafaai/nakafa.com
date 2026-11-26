import { Line } from "@react-three/drei";
import type { SecantCurve } from "@repo/design-system/components/contents/mathematics/secant/model";
import {
  evaluateSecantLimit,
  sampleSecantCurve,
} from "@repo/design-system/components/contents/mathematics/secant/model";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { Array as Arr } from "effect";
import { useMemo } from "react";

const CURVE_XS = Arr.makeBy(41, (i) => -1.5 + i * 0.12);

export function SecantToTangentScene({
  curve,
  parts,
  stepH,
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
}) {
  const a = 0.5;
  const h = Math.max(0.05, Math.min(2.0, stepH));
  const m = evaluateSecantLimit(curve, h);

  const curvePoints = useMemo(
    () =>
      Arr.map(CURVE_XS, (x) => ({
        x,
        y: sampleSecantCurve(curve, x),
        z: 0,
      })),
    [curve]
  );

  const secantPoints = useMemo(
    () => [
      { x: a - 1.2, y: m.anchorY - 1.2 * m.secantSlope, z: 0.04 },
      { x: a + h + 0.9, y: m.movingY + 0.9 * m.secantSlope, z: 0.04 },
    ],
    [h, m.anchorY, m.movingY, m.secantSlope]
  );

  const tangentPoints = useMemo(
    () => [
      { x: a - 1.4, y: m.anchorY - 1.4 * m.tangentSlope, z: -0.02 },
      { x: a + 1.6, y: m.anchorY + 1.6 * m.tangentSlope, z: -0.02 },
    ],
    [m.anchorY, m.tangentSlope]
  );

  return (
    <group>
      {/* Smooth function curve f(x) */}
      <LineEquation
        color={CALCULUS_COLORS.cobaltCurve}
        lineWidth={3}
        points={curvePoints}
        showPoints={false}
        smooth
      />
      {/* Exact tangent line at x = a */}
      <LineEquation
        color={CALCULUS_COLORS.emeraldSlope}
        dashed
        lineWidth={2.5}
        points={tangentPoints}
        showPoints={false}
      />
      {/* Converging secant line through P and Q */}
      <LineEquation
        color={CALCULUS_COLORS.amberAccent}
        lineWidth={2.8}
        points={secantPoints}
        showPoints={false}
      />
      {/* Rise-over-run slope triangle */}
      <Line
        color={CALCULUS_COLORS.violetNormal}
        lineWidth={2.2}
        points={[
          [a, m.anchorY, 0.05],
          [a + h, m.anchorY, 0.05],
          [a + h, m.movingY, 0.05],
        ]}
      />
      {/* Anchor P and Moving Q */}
      <mesh position={[a, m.anchorY, 0.06]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.emeraldSlope}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[a + h, m.movingY, 0.06]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.amberAccent}
          toneMapped={false}
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={CALCULUS_COLORS.cobaltCurve}
        fontSize="compact"
        position={[-1.1, sampleSecantCurve(curve, -1.1) + 0.45, 0]}
      >
        <span>{parts.curveRibbon}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.emeraldSlope}
        fontSize="compact"
        position={[a - 0.35, m.anchorY + 0.45, 0.06]}
      >
        <span>{parts.anchorPoint}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.amberAccent}
        fontSize="compact"
        position={[a + h - 0.32, m.movingY + 0.42, 0.06]}
      >
        <span>{parts.movingPoint}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.violetNormal}
        fontSize="compact"
        position={[a + h * 0.55, m.anchorY - 0.35, 0.06]}
      >
        <span>{parts.slopeTriangle}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.amberAccent}
        fontSize="compact"
        position={[a + h + 0.72, m.movingY + 0.72 * m.secantSlope - 0.12, 0.06]}
      >
        <span>{parts.secantLine}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.emeraldSlope}
        fontSize="compact"
        position={[a - 1.05, m.anchorY - 1.05 * m.tangentSlope - 0.35, 0]}
      >
        <span>{parts.tangentLine}</span>
      </ThreeLabel>
    </group>
  );
}
