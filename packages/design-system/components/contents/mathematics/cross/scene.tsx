import type { CrossOrder } from "@repo/design-system/components/contents/mathematics/cross/model";
import { evaluateCrossProduct } from "@repo/design-system/components/contents/mathematics/cross/model";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { useMemo } from "react";

export function Vector3DCrossProductScene({
  angle,
  order,
  parts,
}: {
  readonly angle: number;
  readonly order: CrossOrder;
  readonly parts: Readonly<
    Record<
      | "coordinateAxes"
      | "crossVector"
      | "curlArc"
      | "parallelogram"
      | "vectorU"
      | "vectorV",
      string
    >
  >;
}) {
  const rad = (angle * Math.PI) / 180;
  const metrics = evaluateCrossProduct(order, angle);
  const ux = 2.0;
  const vx = Math.cos(rad) * 1.6;
  const vz = Math.sin(rad) * 1.6;
  const crossY = metrics.signedNormalY * 0.72;

  const parallelogramVertices = useMemo(
    () => [
      { x: 0, y: 0, z: 0 },
      { x: ux, y: 0, z: 0 },
      { x: ux + vx, y: 0, z: vz },
      { x: vx, y: 0, z: vz },
    ],
    [vx, vz]
  );

  return (
    <group>
      {/* Spanned parallelogram region */}
      <Polygon
        color={CALCULUS_COLORS.cyanPlane}
        opacity={0.32}
        vertices={parallelogramVertices}
      />
      {/* Vector u */}
      <ArrowHelper
        color={CALCULUS_COLORS.cobaltCurve}
        from={[0, 0, 0]}
        label={parts.vectorU}
        labelSize="compact"
        lineWidth={3}
        to={[ux, 0, 0]}
      />
      {/* Vector v */}
      <ArrowHelper
        color={CALCULUS_COLORS.emeraldSlope}
        from={[0, 0, 0]}
        label={parts.vectorV}
        labelSize="compact"
        lineWidth={3}
        to={[vx, 0, vz]}
      />
      {/* Right-hand cross product normal vector */}
      {Math.abs(crossY) > 0.05 ? (
        <ArrowHelper
          color={CALCULUS_COLORS.violetNormal}
          from={[0, 0, 0]}
          label={parts.crossVector}
          labelSize="compact"
          lineWidth={3.4}
          to={[0, crossY, 0]}
        />
      ) : null}
      {/* Right-hand curl arc */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.68, 0.025, 10, 28, Math.max(0.15, rad)]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.amberAccent}
          toneMapped={false}
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={CALCULUS_COLORS.cyanPlane}
        fontSize="compact"
        position={[(ux + vx) * 0.55, -0.22, vz * 0.65]}
      >
        <span>{parts.parallelogram}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.amberAccent}
        fontSize="compact"
        position={[0.88, 0.35, 0.65]}
      >
        <span>{parts.curlArc}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.axisGray}
        fontSize="compact"
        position={[-1.4, -0.3, 0]}
      >
        <span>{parts.coordinateAxes}</span>
      </ThreeLabel>
    </group>
  );
}
