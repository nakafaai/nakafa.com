import { Line } from "@react-three/drei";
import type { PcaSubspace } from "@repo/design-system/components/contents/mathematics/pca/model";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { Array as Arr } from "effect";

const SAMPLES = [
  [-2.2, -0.75, -0.65],
  [-1.65, 0.52, -0.45],
  [-1.1, -0.42, 0.55],
  [-0.55, 0.78, -0.32],
  [0.35, -0.64, 0.58],
  [0.95, 0.58, -0.38],
  [1.55, -0.48, 0.44],
  [2.15, 0.72, 0.62],
] as const;

const PLANE_VERTICES = [
  { x: -2.6, y: 0, z: -1.6 },
  { x: 2.6, y: 0, z: -1.6 },
  { x: 2.6, y: 0, z: 1.6 },
  { x: -2.6, y: 0, z: 1.6 },
] as const;

export function PcaProjection3DScene({
  correlation,
  parts,
  subspace,
}: {
  readonly correlation: number;
  readonly parts: Readonly<
    Record<
      | "pc1Axis"
      | "pc2Axis"
      | "pc3Axis"
      | "pointCloud"
      | "projectionPlane"
      | "residualLines",
      string
    >
  >;
  readonly subspace: PcaSubspace;
}) {
  const spread = 1.25 - correlation * 0.85;

  return (
    <group>
      {/* Principal Component Axes */}
      <ArrowHelper
        color={CALCULUS_COLORS.cobaltCurve}
        from={[-2.5, 0, 0]}
        label={parts.pc1Axis}
        labelSize="compact"
        lineWidth={3}
        to={[2.6, 0, 0]}
      />
      <ArrowHelper
        color={CALCULUS_COLORS.emeraldSlope}
        from={[0, 0, -1.5]}
        label={parts.pc2Axis}
        labelSize="compact"
        lineWidth={2.5}
        to={[0, 0, 1.7]}
      />
      <ArrowHelper
        color={CALCULUS_COLORS.roseAlert}
        from={[0, -1.1, 0]}
        label={parts.pc3Axis}
        labelSize="compact"
        lineWidth={2.2}
        to={[0, 1.4, 0]}
      />
      {/* Subspace projection plane */}
      <Polygon
        color={CALCULUS_COLORS.cyanPlane}
        opacity={subspace === "pc1Pc2Plane" ? 0.28 : 0.08}
        vertices={PLANE_VERTICES}
      />
      {/* 3D point cloud and exact residual drop-lines */}
      {Arr.map(SAMPLES, ([px, py, pz]) => {
        const y = py * spread;
        const z = pz * spread;
        const projZ = subspace === "pc1Line" ? 0 : z;
        return (
          <group key={`${px}-${py}-${pz}`}>
            <mesh position={[px, y, z]}>
              <sphereGeometry args={[0.11, 16, 16]} />
              <meshBasicMaterial
                color={CALCULUS_COLORS.indigoPrism}
                toneMapped={false}
              />
            </mesh>
            {subspace === "full3D" ? null : (
              <>
                <Line
                  color={CALCULUS_COLORS.roseAlert}
                  dashed
                  dashSize={0.12}
                  gapSize={0.08}
                  lineWidth={2}
                  points={[
                    [px, y, z],
                    [px, 0, projZ],
                  ]}
                />
                <mesh position={[px, 0, projZ]}>
                  <sphereGeometry args={[0.075, 12, 12]} />
                  <meshBasicMaterial
                    color={CALCULUS_COLORS.amberAccent}
                    toneMapped={false}
                  />
                </mesh>
              </>
            )}
          </group>
        );
      })}
      <ThreeLabel
        color={CALCULUS_COLORS.indigoPrism}
        fontSize="compact"
        position={[-2.1, 1.05, 0.35]}
      >
        <span>{parts.pointCloud}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.cyanPlane}
        fontSize="compact"
        position={[1.85, -0.35, 1.4]}
      >
        <span>{parts.projectionPlane}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.roseAlert}
        fontSize="compact"
        position={[-1.85, -0.82, -0.35]}
      >
        <span>{parts.residualLines}</span>
      </ThreeLabel>
    </group>
  );
}
