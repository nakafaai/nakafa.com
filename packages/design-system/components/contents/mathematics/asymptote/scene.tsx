import type { AsymptoteCurve } from "@repo/design-system/components/contents/mathematics/asymptote/model";
import { evaluateAsymptoteProbe } from "@repo/design-system/components/contents/mathematics/asymptote/model";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { Array as Arr } from "effect";
import { useMemo } from "react";

function clampY(y: number): number {
  return Math.max(-2.6, Math.min(2.6, y));
}

export function AsymptoteBehaviorScene({
  curve,
  parts,
  probeX,
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
}) {
  const probe = evaluateAsymptoteProbe(curve, probeX);
  const poleX = probe.verticalX;

  const leftBranch = useMemo(
    () =>
      Arr.makeBy(24, (i) => {
        const x = -2.8 + (i / 23) * (poleX - 0.16 - -2.8);
        return {
          x,
          y: clampY(evaluateAsymptoteProbe(curve, x).valueY),
          z: 0.04,
        };
      }),
    [curve, poleX]
  );

  const rightBranch = useMemo(
    () =>
      Arr.makeBy(24, (i) => {
        const x = poleX + 0.16 + (i / 23) * (2.8 - (poleX + 0.16));
        return {
          x,
          y: clampY(evaluateAsymptoteProbe(curve, x).valueY),
          z: 0.04,
        };
      }),
    [curve, poleX]
  );

  const verticalAsymptotePts = useMemo(
    () => [
      { x: poleX, y: -2.8, z: 0 },
      { x: poleX, y: 2.8, z: 0 },
    ],
    [poleX]
  );

  const horizontalAsymptotePts = useMemo(() => {
    if (curve === "obliqueSlant") {
      return [
        { x: -2.8, y: -2.8 * 0.45, z: 0 },
        { x: 2.8, y: 2.8 * 0.45, z: 0 },
      ];
    }
    const y = curve === "rationalHorizontal" ? 0.8 : 0;
    return [
      { x: -2.8, y, z: 0 },
      { x: 2.8, y, z: 0 },
    ];
  }, [curve]);

  const leftX = -Math.max(0.25, Math.abs(probeX));
  const leftY = clampY(evaluateAsymptoteProbe(curve, leftX).valueY);
  const rightY = clampY(probe.valueY);

  return (
    <group>
      {/* Asymptote dashed lines */}
      <LineEquation
        color={CALCULUS_COLORS.roseAlert}
        dashed
        lineWidth={2.4}
        points={verticalAsymptotePts}
        showPoints={false}
      />
      <LineEquation
        color={CALCULUS_COLORS.emeraldSlope}
        dashed
        lineWidth={2.4}
        points={horizontalAsymptotePts}
        showPoints={false}
      />
      {/* Left and right curve branches */}
      <LineEquation
        color={CALCULUS_COLORS.cobaltCurve}
        lineWidth={3}
        points={leftBranch}
        showPoints={false}
        smooth
      />
      <LineEquation
        color={CALCULUS_COLORS.cobaltCurve}
        lineWidth={3}
        points={rightBranch}
        showPoints={false}
        smooth
      />
      {/* Active probes */}
      <mesh position={[probeX, rightY, 0.08]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.amberAccent}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[leftX, leftY, 0.08]}>
        <sphereGeometry args={[0.095, 14, 14]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.violetNormal}
          toneMapped={false}
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={CALCULUS_COLORS.roseAlert}
        fontSize="compact"
        position={[poleX + 0.25, 2.35, 0]}
      >
        <span>{parts.verticalAsymptote}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.emeraldSlope}
        fontSize="compact"
        position={[2.15, horizontalAsymptotePts[1].y - 0.34, 0]}
      >
        <span>{parts.horizontalAsymptote}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.cobaltCurve}
        fontSize="compact"
        position={[-2.1, 1.35, 0]}
      >
        <span>{parts.curveBranches}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.amberAccent}
        fontSize="compact"
        position={[probeX + 0.25, rightY + 0.32, 0.1]}
      >
        <span>{parts.rightProbe}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.violetNormal}
        fontSize="compact"
        position={[leftX - 0.25, leftY - 0.35, 0.1]}
      >
        <span>{parts.leftProbe}</span>
      </ThreeLabel>
    </group>
  );
}
