import { Line } from "@react-three/drei";
import type { QrStep } from "@repo/design-system/components/contents/mathematics/qr/model";
import { evaluateQrStep } from "@repo/design-system/components/contents/mathematics/qr/model";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";

const RIGHT_ANGLE_SQUARE = [
  { x: 0, y: 0, z: 0 },
  { x: 0.38, y: 0, z: 0 },
  { x: 0.38, y: 0.38, z: 0 },
  { x: 0, y: 0.38, z: 0 },
] as const;

export function QrGramSchmidt3DScene({
  parts,
  skew,
  step,
}: {
  readonly parts: Readonly<
    Record<
      | "inputVectors"
      | "orthogonalFrame"
      | "orthonormalBasis"
      | "projectionShadow"
      | "unitSphere",
      string
    >
  >;
  readonly skew: number;
  readonly step: QrStep;
}) {
  const state = evaluateQrStep(step, skew);
  const q1Len = step === "originalBasis" ? 2.4 : 1.8;
  const q2To: readonly [number, number, number] = [
    Math.sin(state.q2TiltRad) * 1.8,
    Math.cos(state.q2TiltRad) * 1.8,
    0,
  ];
  const q3To: readonly [number, number, number] = [
    Math.sin(state.q3TiltRad) * 1.2,
    Math.sin(state.q3TiltRad) * 0.9,
    Math.cos(state.q3TiltRad) * 1.8,
  ];
  const rProj = state.r12 * 1.8;

  return (
    <group>
      {/* Unit sphere reference */}
      <mesh>
        <sphereGeometry args={[1.8, 28, 22]} />
        <meshStandardMaterial
          color={CALCULUS_COLORS.baseSlate}
          opacity={0.12}
          transparent
          wireframe
        />
      </mesh>
      {/* q1 vector */}
      <ArrowHelper
        color={CALCULUS_COLORS.cobaltCurve}
        from={[0, 0, 0]}
        label={parts.orthonormalBasis}
        labelSize="compact"
        lineWidth={3}
        to={[q1Len, 0, 0]}
      />
      {/* q2 vector */}
      <ArrowHelper
        color={CALCULUS_COLORS.emeraldSlope}
        from={[0, 0, 0]}
        label={parts.inputVectors}
        labelSize="compact"
        lineWidth={3}
        to={q2To}
      />
      {/* q3 vector */}
      <ArrowHelper
        color={CALCULUS_COLORS.violetNormal}
        from={[0, 0, 0]}
        label={parts.orthogonalFrame}
        labelOffset={[-0.25, -0.25, 0.2]}
        labelSize="compact"
        lineWidth={3}
        to={q3To}
      />
      {/* Projection shadow along q1 */}
      <ArrowHelper
        color={CALCULUS_COLORS.amberAccent}
        from={[0, 0, 0]}
        label={parts.projectionShadow}
        labelOffset={[0, -0.35, 0]}
        labelSize="compact"
        lineWidth={2.5}
        to={[Math.max(0.15, rProj), 0, 0]}
      />
      <Line
        color={CALCULUS_COLORS.amberAccent}
        dashed
        dashSize={0.12}
        gapSize={0.08}
        lineWidth={1.8}
        points={[
          [q2To[0], q2To[1], q2To[2]],
          [q2To[0], 0, 0],
        ]}
      />
      {/* Right-angle marker once q2 is orthogonalized */}
      {state.q2TiltRad === 0 ? (
        <Polygon
          color={CALCULUS_COLORS.cyanPlane}
          opacity={0.35}
          vertices={RIGHT_ANGLE_SQUARE}
        />
      ) : null}
      <ThreeLabel
        color={CALCULUS_COLORS.axisGray}
        fontSize="compact"
        position={[-1.65, 1.25, 0]}
      >
        <span>{parts.unitSphere}</span>
      </ThreeLabel>
    </group>
  );
}
