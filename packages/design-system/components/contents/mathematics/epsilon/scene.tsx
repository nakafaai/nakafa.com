import type { EpsilonFunction } from "@repo/design-system/components/contents/mathematics/epsilon/model";
import { evaluateEpsilonDelta } from "@repo/design-system/components/contents/mathematics/epsilon/model";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { Array as Arr } from "effect";
import { useMemo } from "react";

const LEFT_XS = Arr.makeBy(18, (i) => -2.2 + i * 0.12);
const RIGHT_XS = Arr.makeBy(18, (i) => 0.16 + i * 0.12);

function sampleFn(fn: EpsilonFunction, x: number): number {
  if (fn === "removableHole") {
    return 1 + 0.7 * x;
  }
  if (fn === "quadraticSmooth") {
    return 1 + 0.55 * x + 0.25 * x * x;
  }
  return 1 + 1.25 * x;
}

export function EpsilonDeltaBandScene({
  epsilon,
  fn,
  parts,
}: {
  readonly epsilon: number;
  readonly fn: EpsilonFunction;
  readonly parts: Readonly<
    Record<
      "curvePath" | "deltaBand" | "epsilonBand" | "holePoint" | "limitTarget",
      string
    >
  >;
}) {
  const bound = evaluateEpsilonDelta(fn, epsilon);
  const epsH = Math.min(1.4, Math.max(0.08, epsilon));
  const delW = Math.min(2.0, Math.max(0.08, bound.delta * 1.4));

  const leftPts = useMemo(
    () => Arr.map(LEFT_XS, (x) => ({ x, y: sampleFn(fn, x), z: 0.04 })),
    [fn]
  );
  const rightPts = useMemo(
    () => Arr.map(RIGHT_XS, (x) => ({ x, y: sampleFn(fn, x), z: 0.04 })),
    [fn]
  );

  const epsilonQuad = useMemo(
    () => [
      { x: -2.4, y: bound.limitL - epsH, z: -0.02 },
      { x: 2.4, y: bound.limitL - epsH, z: -0.02 },
      { x: 2.4, y: bound.limitL + epsH, z: -0.02 },
      { x: -2.4, y: bound.limitL + epsH, z: -0.02 },
    ],
    [bound.limitL, epsH]
  );

  const deltaQuad = useMemo(
    () => [
      { x: -delW, y: -0.8, z: -0.01 },
      { x: delW, y: -0.8, z: -0.01 },
      { x: delW, y: 2.8, z: -0.01 },
      { x: -delW, y: 2.8, z: -0.01 },
    ],
    [delW]
  );

  return (
    <group>
      {/* Horizontal epsilon corridor */}
      <Polygon
        color={CALCULUS_COLORS.emeraldSlope}
        opacity={0.22}
        vertices={epsilonQuad}
      />
      {/* Vertical delta corridor */}
      <Polygon
        color={CALCULUS_COLORS.cyanPlane}
        opacity={0.24}
        vertices={deltaQuad}
      />
      {/* Function curve split cleanly at removable hole */}
      <LineEquation
        color={CALCULUS_COLORS.cobaltCurve}
        endpoints={{ end: "open" }}
        lineWidth={3}
        points={leftPts}
        showPoints={false}
        smooth
      />
      <LineEquation
        color={CALCULUS_COLORS.cobaltCurve}
        endpoints={{ start: "open" }}
        lineWidth={3}
        points={rightPts}
        showPoints={false}
        smooth
      />
      {/* Open ring at removable hole (0, L) */}
      <mesh position={[0, bound.limitL, 0.06]}>
        <torusGeometry args={[0.11, 0.028, 12, 24]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.roseAlert}
          toneMapped={false}
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={CALCULUS_COLORS.emeraldSlope}
        fontSize="compact"
        position={[1.75, bound.limitL + epsH + 0.2, 0]}
      >
        <span>{parts.epsilonBand}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.cyanPlane}
        fontSize="compact"
        position={[delW + 0.25, -0.45, 0]}
      >
        <span>{parts.deltaBand}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.cobaltCurve}
        fontSize="compact"
        position={[-1.7, sampleFn(fn, -1.6) + 0.45, 0]}
      >
        <span>{parts.curvePath}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.roseAlert}
        fontSize="compact"
        position={[-0.45, bound.limitL + 0.42, 0.08]}
      >
        <span>{parts.holePoint}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.axisGray}
        fontSize="compact"
        position={[-2.1, bound.limitL, 0]}
      >
        <span>{parts.limitTarget}</span>
      </ThreeLabel>
    </group>
  );
}
