import { useFrame, useThree } from "@react-three/fiber";
import type { LactaseMethod } from "@repo/design-system/components/contents/biology/lactase/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ENZYME_COLORS } from "@repo/design-system/lib/material/enzyme";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Mesh } from "three";

const BEAD_COORDS = [
  [-0.08, 0.72, 0.04],
  [0.08, 0.76, -0.04],
  [0, 0.88, 0.06],
  [-0.07, 0.96, -0.05],
  [0.09, 1.04, 0.04],
  [-0.02, 1.12, 0.0],
  [0.07, 0.64, 0.05],
  [-0.08, 0.62, -0.04],
] as const;

function ColumnCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.85, 3.85] : [0, 1.45, 3.05]}
      cameraTarget={[0, 0.62, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.5}
    />
  );
}

export function LactaseScene({
  flowRate,
  glucosePositive,
  method,
  parts,
}: {
  readonly flowRate: number;
  readonly glucosePositive: boolean;
  readonly method: LactaseMethod;
  readonly parts: Readonly<
    Record<"column" | "beads" | "milk" | "strip", string>
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const dropRef = useRef<Mesh>(null);
  const fall = useRef(0);

  useFrame((_, delta) => {
    const drop = dropRef.current;
    if (drop === null || !playing) {
      return;
    }
    fall.current =
      (fall.current + simulationStep(delta) * (0.35 + flowRate * 0.08)) % 1;
    drop.position.y = 0.48 - fall.current * 0.34;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <ColumnCamera />
      {method === "immobilised" ? (
        <group>
          <mesh castShadow position={[0, 0.94, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.92, 24]} />
            <meshPhysicalMaterial
              color={ENZYME_COLORS.glassColumn}
              opacity={0.34}
              roughness={0.12}
              transparent
            />
          </mesh>
          <mesh position={[0, 0.88, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.72, 20]} />
            <meshStandardMaterial
              color={ENZYME_COLORS.milkLiquid}
              opacity={0.72}
              roughness={0.35}
              transparent
            />
          </mesh>
          {Arr.map(BEAD_COORDS, (pos) => (
            <mesh
              castShadow
              key={`${pos[0]}-${pos[1]}`}
              position={[pos[0], pos[1], pos[2]]}
            >
              <sphereGeometry args={[0.056, 14, 10]} />
              <meshStandardMaterial
                color={ENZYME_COLORS.alginateBead}
                roughness={0.35}
              />
            </mesh>
          ))}
          <mesh position={[0, 0.36, 0]} ref={dropRef}>
            <sphereGeometry args={[0.036, 12, 10]} />
            <meshStandardMaterial
              color={ENZYME_COLORS.milkLiquid}
              roughness={0.25}
            />
          </mesh>
          <ThreeLabel
            color={ENZYME_COLORS.labelInk}
            fontSize="compact"
            position={[-0.45, 1.15, 0]}
          >
            <span>{parts.column}</span>
          </ThreeLabel>
          <ThreeLabel
            color={ENZYME_COLORS.labelInk}
            fontSize="compact"
            position={[0.48, 0.9, 0]}
          >
            <span>{parts.beads}</span>
          </ThreeLabel>
        </group>
      ) : (
        <group>
          <mesh castShadow position={[0, 0.72, 0]}>
            <cylinderGeometry args={[0.42, 0.4, 0.68, 28]} />
            <meshPhysicalMaterial
              color={ENZYME_COLORS.glassColumn}
              opacity={0.34}
              roughness={0.12}
              transparent
            />
          </mesh>
          <mesh position={[0, 0.66, 0]}>
            <cylinderGeometry args={[0.38, 0.37, 0.52, 24]} />
            <meshStandardMaterial
              color={ENZYME_COLORS.milkLiquid}
              roughness={0.35}
            />
          </mesh>
          {Arr.map(BEAD_COORDS, (pos) => (
            <mesh
              key={`free-${pos[0]}-${pos[1]}`}
              position={[pos[0] * 1.9, pos[1] - 0.18, pos[2] * 1.9]}
            >
              <sphereGeometry args={[0.028, 10, 8]} />
              <meshStandardMaterial
                color={ENZYME_COLORS.lactase}
                roughness={0.4}
              />
            </mesh>
          ))}
          <ThreeLabel
            color={ENZYME_COLORS.labelInk}
            fontSize="compact"
            position={[-0.58, 0.88, 0]}
          >
            <span>{parts.milk}</span>
          </ThreeLabel>
        </group>
      )}

      {/* Effluent beaker + glucose test strip */}
      <group position={[0, 0.18, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.32, 0.3, 0.36, 24]} />
          <meshPhysicalMaterial
            color={ENZYME_COLORS.glassColumn}
            opacity={0.34}
            roughness={0.12}
            transparent
          />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.29, 0.28, 0.22, 20]} />
          <meshStandardMaterial
            color={ENZYME_COLORS.milkLiquid}
            roughness={0.35}
          />
        </mesh>
        <group position={[0.2, 0.08, 0.06]} rotation={[0, 0, -0.25]}>
          <mesh castShadow>
            <boxGeometry args={[0.045, 0.38, 0.012]} />
            <meshStandardMaterial
              color={ENZYME_COLORS.stripBase}
              roughness={0.65}
            />
          </mesh>
          <mesh position={[0, -0.12, 0.008]}>
            <boxGeometry args={[0.048, 0.09, 0.01]} />
            <meshStandardMaterial
              color={
                glucosePositive
                  ? ENZYME_COLORS.stripPositive
                  : ENZYME_COLORS.stripNegative
              }
              roughness={0.45}
            />
          </mesh>
        </group>
        <ThreeLabel
          color={ENZYME_COLORS.labelInk}
          fontSize="compact"
          position={[-0.48, 0.02, 0.2]}
        >
          <span>{parts.milk}</span>
        </ThreeLabel>
        <ThreeLabel
          color={ENZYME_COLORS.labelInk}
          fontSize="compact"
          position={[0.52, 0.24, 0.12]}
        >
          <span>{parts.strip}</span>
        </ThreeLabel>
      </group>
    </group>
  );
}
