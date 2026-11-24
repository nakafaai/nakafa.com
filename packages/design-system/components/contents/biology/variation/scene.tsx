import { useThree } from "@react-three/fiber";
import type { VariationKind } from "@repo/design-system/components/contents/biology/variation/model";
import { evaluateVariationBars } from "@repo/design-system/components/contents/biology/variation/model";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr } from "effect";

function VariationCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.35] : [0, 1.28, 2.75]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function VariationDistributionScene({
  genePairs,
  kind,
  parts,
}: {
  readonly genePairs: number;
  readonly kind: VariationKind;
  readonly parts: Readonly<
    Record<"bellCurve" | "discreteBars" | "environment" | "meanLine", string>
  >;
}) {
  const bars = evaluateVariationBars(kind, genePairs);
  const barWidth =
    kind === "continuous" ? Math.min(0.24, 1.65 / bars.length) : 0.28;

  return (
    <group>
      <VariationCamera />
      {/* Base axis platform */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[2.25, 0.08, 0.65]} />
        <meshStandardMaterial
          color={GENETICS_COLORS.boardSlate}
          roughness={0.65}
        />
      </mesh>
      {/* Histogram columns */}
      {Arr.map(bars, (bar) => (
        <mesh
          castShadow
          key={bar.id}
          position={[bar.x, 0.09 + bar.height * 0.5, 0]}
        >
          <boxGeometry args={[barWidth, bar.height, 0.34]} />
          <meshStandardMaterial
            color={
              kind === "continuous"
                ? GENETICS_COLORS.bellCurveBlue
                : GENETICS_COLORS.discreteViolet
            }
            roughness={0.4}
          />
        </mesh>
      ))}
      {/* Mean vertical guide line for continuous distribution */}
      {kind === "continuous" ? (
        <group>
          <mesh position={[0, 0.66, 0.22]}>
            <cylinderGeometry args={[0.015, 0.015, 1.15, 10]} />
            <meshStandardMaterial color={GENETICS_COLORS.meanAmber} />
          </mesh>
          <mesh position={[0.42, 0.14, 0.24]}>
            <boxGeometry args={[0.7, 0.04, 0.06]} />
            <meshStandardMaterial color={GENETICS_COLORS.envShiftTeal} />
          </mesh>
        </group>
      ) : null}
      {/* Labels */}
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 1.12, 0]}
      >
        <span>
          {kind === "continuous" ? parts.bellCurve : parts.discreteBars}
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.28, 0.22]}
      >
        <span>{parts.meanLine}</span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0.78, 0.34, 0.34]}
      >
        <span>{parts.environment}</span>
      </ThreeLabel>
    </group>
  );
}
