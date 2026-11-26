import { Line } from "@react-three/drei";
import type { SlopeCurve } from "@repo/design-system/components/contents/mathematics/slope/model";
import { evaluateSlopeField } from "@repo/design-system/components/contents/mathematics/slope/model";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { Array as Arr } from "effect";
import { useMemo } from "react";

const CURVE_XS = Arr.makeBy(41, (i) => -2.2 + i * 0.11);
const NEEDLE_XS = Arr.makeBy(11, (i) => -2.0 + i * 0.4);

export function DerivativeSlopeFieldScene({
  curve,
  parts,
  probeX,
}: {
  readonly curve: SlopeCurve;
  readonly parts: Readonly<
    Record<
      | "criticalPoints"
      | "derivativeCurve"
      | "functionCurve"
      | "probeMarker"
      | "slopeNeedles",
      string
    >
  >;
  readonly probeX: number;
}) {
  const probe = evaluateSlopeField(curve, probeX);

  const fnPoints = useMemo(
    () =>
      Arr.map(CURVE_XS, (x) => ({
        x,
        y: evaluateSlopeField(curve, x).value,
        z: 0.4,
      })),
    [curve]
  );

  const derivPoints = useMemo(
    () =>
      Arr.map(CURVE_XS, (x) => ({
        x,
        y: evaluateSlopeField(curve, x).derivative,
        z: -0.6,
      })),
    [curve]
  );

  const probeLen = 0.65;
  const norm = Math.hypot(1, probe.derivative);
  const dx = (probeLen / norm) * 1;
  const dy = (probeLen / norm) * probe.derivative;

  return (
    <group>
      {/* Function curve f(x) */}
      <LineEquation
        color={CALCULUS_COLORS.cobaltCurve}
        lineWidth={3}
        points={fnPoints}
        showPoints={false}
        smooth
      />
      {/* Derivative curve f'(x) */}
      <LineEquation
        color={CALCULUS_COLORS.emeraldSlope}
        lineWidth={2.6}
        points={derivPoints}
        showPoints={false}
        smooth
      />
      {/* Local slope needles along f(x) */}
      {Arr.map(NEEDLE_XS, (x) => {
        const pt = evaluateSlopeField(curve, x);
        const s = 0.22 / Math.hypot(1, pt.derivative);
        const isCritical = Math.abs(pt.derivative) < 0.25;
        return (
          <group key={x}>
            <Line
              color={CALCULUS_COLORS.amberAccent}
              lineWidth={2}
              points={[
                [x - s, pt.value - s * pt.derivative, 0.44],
                [x + s, pt.value + s * pt.derivative, 0.44],
              ]}
            />
            {isCritical ? (
              <mesh position={[x, pt.value, 0.46]}>
                <sphereGeometry args={[0.09, 14, 14]} />
                <meshBasicMaterial
                  color={CALCULUS_COLORS.roseAlert}
                  toneMapped={false}
                />
              </mesh>
            ) : null}
          </group>
        );
      })}
      {/* Probe tangent segment & vertical connector to f'(x) */}
      <mesh position={[probeX, probe.value, 0.48]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.amberAccent}
          toneMapped={false}
        />
      </mesh>
      <Line
        color={CALCULUS_COLORS.amberAccent}
        lineWidth={3.2}
        points={[
          [probeX - dx, probe.value - dy, 0.48],
          [probeX + dx, probe.value + dy, 0.48],
        ]}
      />
      <Line
        color={CALCULUS_COLORS.violetNormal}
        dashed
        dashSize={0.1}
        gapSize={0.08}
        lineWidth={2}
        points={[
          [probeX, probe.value, 0.42],
          [probeX, probe.derivative, -0.6],
        ]}
      />
      <mesh position={[probeX, probe.derivative, -0.6]}>
        <sphereGeometry args={[0.09, 14, 14]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.emeraldSlope}
          toneMapped={false}
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={CALCULUS_COLORS.cobaltCurve}
        fontSize="compact"
        position={[-1.9, 1.95, 0.4]}
      >
        <span>{parts.functionCurve}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.emeraldSlope}
        fontSize="compact"
        position={[1.85, 1.8, -0.6]}
      >
        <span>{parts.derivativeCurve}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.amberAccent}
        fontSize="compact"
        position={[probeX - 0.45, probe.value + 0.48, 0.48]}
      >
        <span>{parts.probeMarker}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.amberAccent}
        fontSize="compact"
        position={[-1.85, -0.4, 0.4]}
      >
        <span>{parts.slopeNeedles}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.roseAlert}
        fontSize="compact"
        position={[1.55, -0.45, 0.4]}
      >
        <span>{parts.criticalPoints}</span>
      </ThreeLabel>
    </group>
  );
}
