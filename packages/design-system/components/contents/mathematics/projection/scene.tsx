import { Line } from "@react-three/drei";
import { evaluateDotProjection } from "@repo/design-system/components/contents/mathematics/projection/model";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";

export function DotProductProjection3DScene({
  angle,
  parts,
}: {
  readonly angle: number;
  readonly parts: Readonly<
    Record<
      | "angleArc"
      | "coordinateAxes"
      | "dropLine"
      | "projectionVector"
      | "vectorU"
      | "vectorV",
      string
    >
  >;
}) {
  const rad = (angle * Math.PI) / 180;
  const reading = evaluateDotProjection(angle);
  const ux = Math.cos(rad) * 2.2;
  const uy = Math.sin(rad) * 2.2;
  const projColor =
    reading.dotProduct >= 0
      ? CALCULUS_COLORS.amberAccent
      : CALCULUS_COLORS.roseAlert;

  return (
    <group>
      {/* Vector v along +X */}
      <ArrowHelper
        color={CALCULUS_COLORS.emeraldSlope}
        from={[0, 0, 0]}
        label={parts.vectorV}
        labelSize="compact"
        lineWidth={3}
        to={[2.6, 0, 0]}
      />
      {/* Vector u at angle */}
      <ArrowHelper
        color={CALCULUS_COLORS.cobaltCurve}
        from={[0, 0, 0]}
        label={parts.vectorU}
        labelSize="compact"
        lineWidth={3}
        to={[ux, uy, 0]}
      />
      {/* Signed orthogonal projection vector onto v */}
      {Math.abs(ux) > 0.06 ? (
        <ArrowHelper
          color={projColor}
          from={[0, 0, 0.06]}
          label={parts.projectionVector}
          labelOffset={[0, -0.4, 0]}
          labelSize="compact"
          lineWidth={3.2}
          to={[ux, 0, 0.06]}
        />
      ) : null}
      {/* Dashed orthogonal drop-line from tip of u onto v axis */}
      {uy > 0.06 ? (
        <Line
          color={CALCULUS_COLORS.violetNormal}
          dashed
          dashSize={0.12}
          gapSize={0.08}
          lineWidth={2.2}
          points={[
            [ux, uy, 0.04],
            [ux, 0, 0.04],
          ]}
        />
      ) : null}
      {/* Angle arc */}
      <mesh>
        <torusGeometry args={[0.62, 0.024, 10, 28, Math.max(0.1, rad)]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.cyanPlane}
          toneMapped={false}
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={CALCULUS_COLORS.violetNormal}
        fontSize="compact"
        position={[ux + 0.3, uy * 0.5, 0.08]}
      >
        <span>{parts.dropLine}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.cyanPlane}
        fontSize="compact"
        position={[0.65, 0.55, 0.08]}
      >
        <span>{parts.angleArc}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.axisGray}
        fontSize="compact"
        position={[-2.1, -0.35, 0]}
      >
        <span>{parts.coordinateAxes}</span>
      </ThreeLabel>
    </group>
  );
}
