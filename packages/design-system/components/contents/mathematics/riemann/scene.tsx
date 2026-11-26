import type {
  RiemannCurve,
  RiemannMethod,
} from "@repo/design-system/components/contents/mathematics/riemann/model";
import { sampleRiemannCurve } from "@repo/design-system/components/contents/mathematics/riemann/model";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { Array as Arr } from "effect";
import { useMemo } from "react";

const CURVE_XS = Arr.makeBy(41, (i) => i * 0.05);

function prismHeight(
  curve: RiemannCurve,
  method: RiemannMethod,
  x0: number,
  x1: number
): number {
  if (method === "left") {
    return sampleRiemannCurve(curve, x0);
  }
  if (method === "right") {
    return sampleRiemannCurve(curve, x1);
  }
  if (method === "midpoint") {
    return sampleRiemannCurve(curve, (x0 + x1) * 0.5);
  }
  return (sampleRiemannCurve(curve, x0) + sampleRiemannCurve(curve, x1)) * 0.5;
}

export function RiemannSumConvergenceScene({
  curve,
  method,
  partitions,
  parts,
}: {
  readonly curve: RiemannCurve;
  readonly method: RiemannMethod;
  readonly partitions: number;
  readonly parts: Readonly<
    Record<
      | "baseAxis"
      | "curveSurface"
      | "exactArea"
      | "riemannPrisms"
      | "samplePoints",
      string
    >
  >;
}) {
  const n = Math.min(32, Math.max(2, Math.round(partitions)));
  const dx = 2 / n;
  const indices = Arr.makeBy(n, (i) => i);

  const curvePoints = useMemo(
    () =>
      Arr.map(CURVE_XS, (x) => ({
        x: x * 2,
        y: sampleRiemannCurve(curve, x),
        z: 0.3,
      })),
    [curve]
  );

  return (
    <group>
      <hemisphereLight
        args={[CALCULUS_COLORS.lightSky, CALCULUS_COLORS.lightGround, 1.25]}
      />
      {/* Smooth integrand curve */}
      <LineEquation
        color={CALCULUS_COLORS.cobaltCurve}
        lineWidth={3.2}
        points={curvePoints}
        showPoints={false}
        smooth
      />
      {/* 3D Riemann prisms */}
      {Arr.map(indices, (i) => {
        const x0 = i * dx;
        const x1 = (i + 1) * dx;
        const h = Math.max(0.08, prismHeight(curve, method, x0, x1));
        const cx = (x0 + dx * 0.5) * 2;
        let sampleX = cx;
        if (method === "left") {
          sampleX = x0 * 2;
        } else if (method === "right") {
          sampleX = x1 * 2;
        }
        return (
          <group key={i}>
            <mesh position={[cx, h * 0.5, 0]}>
              <boxGeometry args={[dx * 1.92, h, 0.55]} />
              <meshStandardMaterial
                color={CALCULUS_COLORS.indigoPrism}
                opacity={0.55}
                roughness={0.35}
                transparent
              />
            </mesh>
            <mesh position={[sampleX, h, 0.3]}>
              <sphereGeometry args={[0.055, 10, 10]} />
              <meshBasicMaterial
                color={CALCULUS_COLORS.amberAccent}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
      {/* Labels */}
      <ThreeLabel
        color={CALCULUS_COLORS.cobaltCurve}
        fontSize="compact"
        position={[0.4, 2.0, 0.3]}
      >
        <span>{parts.curveSurface}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.indigoPrism}
        fontSize="compact"
        position={[3.6, 1.75, 0.35]}
      >
        <span>{parts.riemannPrisms}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.amberAccent}
        fontSize="compact"
        position={[2.45, 1.55, 0.35]}
      >
        <span>{parts.samplePoints}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.axisGray}
        fontSize="compact"
        position={[2.0, -0.35, 0.45]}
      >
        <span>{parts.baseAxis}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.emeraldSlope}
        fontSize="compact"
        position={[3.8, 0.55, -0.4]}
      >
        <span>{parts.exactArea}</span>
      </ThreeLabel>
    </group>
  );
}
