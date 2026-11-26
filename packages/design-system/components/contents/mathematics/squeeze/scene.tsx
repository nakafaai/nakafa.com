import type { SqueezeEnvelope } from "@repo/design-system/components/contents/mathematics/squeeze/model";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { Array as Arr } from "effect";
import { useMemo } from "react";

const SAMPLES = Arr.makeBy(81, (i) => -2.0 + i * 0.05);

function sampleBounds(envelope: SqueezeEnvelope, x: number) {
  const ax = Math.abs(x);
  if (envelope === "quadraticSine") {
    const env = 0.45 * x * x;
    return {
      lower: -env,
      mid: env * Math.sin(x === 0 ? 0 : 6.0 / (ax + 0.12)),
      upper: env,
    };
  }
  if (envelope === "linearDamped") {
    const env = 0.72 * ax;
    return {
      lower: -env,
      mid: env * Math.cos(x === 0 ? 0 : 6.2 / (ax + 0.14)),
      upper: env,
    };
  }
  const cosX = Math.cos(ax * 0.9);
  const sinc = ax < 0.02 ? 1 : Math.sin(ax * 0.9) / (ax * 0.9);
  return {
    lower: cosX,
    mid: sinc,
    upper: 1,
  };
}

export function SqueezeTheoremWaveScene({
  envelope,
  parts,
  radius,
}: {
  readonly envelope: SqueezeEnvelope;
  readonly parts: Readonly<
    Record<
      | "lowerBound"
      | "pinchPoint"
      | "squeezedWave"
      | "upperBound"
      | "windowFrame",
      string
    >
  >;
  readonly radius: number;
}) {
  const pinchY = envelope === "sincEnvelope" ? 1 : 0;
  const winW = Math.min(2.0, Math.max(0.15, radius));

  const curves = useMemo(() => {
    const upper = Arr.map(SAMPLES, (x) => ({
      x,
      y: sampleBounds(envelope, x).upper,
      z: 0,
    }));
    const lower = Arr.map(SAMPLES, (x) => ({
      x,
      y: sampleBounds(envelope, x).lower,
      z: 0,
    }));
    const mid = Arr.map(SAMPLES, (x) => ({
      x,
      y: sampleBounds(envelope, x).mid,
      z: 0.05,
    }));
    return { lower, mid, upper };
  }, [envelope]);

  const windowQuad = useMemo(
    () => [
      { x: -winW, y: -1.8, z: -0.02 },
      { x: winW, y: -1.8, z: -0.02 },
      { x: winW, y: 1.8, z: -0.02 },
      { x: -winW, y: 1.8, z: -0.02 },
    ],
    [winW]
  );

  return (
    <group>
      {/* Window radius highlight corridor */}
      <Polygon
        color={CALCULUS_COLORS.cyanPlane}
        opacity={0.18}
        vertices={windowQuad}
      />
      {/* Upper and lower bounding envelopes */}
      <LineEquation
        color={CALCULUS_COLORS.emeraldSlope}
        dashed
        lineWidth={2.5}
        points={curves.upper}
        showPoints={false}
        smooth
      />
      <LineEquation
        color={CALCULUS_COLORS.limeEnvelope}
        dashed
        lineWidth={2.5}
        points={curves.lower}
        showPoints={false}
        smooth
      />
      {/* Trapped oscillating wave */}
      <LineEquation
        color={CALCULUS_COLORS.cobaltCurve}
        lineWidth={3}
        points={curves.mid}
        showPoints={false}
      />
      {/* Pinch limit beacon */}
      <mesh position={[0, pinchY, 0.08]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.roseAlert}
          toneMapped={false}
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={CALCULUS_COLORS.emeraldSlope}
        fontSize="compact"
        position={[-1.65, 1.5, 0]}
      >
        <span>{parts.upperBound}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.limeEnvelope}
        fontSize="compact"
        position={[-1.65, -1.45, 0]}
      >
        <span>{parts.lowerBound}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.cobaltCurve}
        fontSize="compact"
        position={[1.55, 0.72, 0.08]}
      >
        <span>{parts.squeezedWave}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.roseAlert}
        fontSize="compact"
        position={[0.25, pinchY + 0.35, 0.1]}
      >
        <span>{parts.pinchPoint}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.cyanPlane}
        fontSize="compact"
        position={[winW + 0.25, -1.25, 0]}
      >
        <span>{parts.windowFrame}</span>
      </ThreeLabel>
    </group>
  );
}
