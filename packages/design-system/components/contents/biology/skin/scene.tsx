import { useFrame, useThree } from "@react-three/fiber";
import type { ThermalCondition } from "@repo/design-system/components/contents/biology/skin/model";
import { evaluateSkin } from "@repo/design-system/components/contents/biology/skin/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { useRef } from "react";
import type { Group } from "three";

function SkinCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.6, 1.45, 3.2] : [0.4, 1.25, 2.55]}
      cameraTarget={[0, 0.58, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.3}
    />
  );
}

export function SkinThermoregulationScene({
  ambientC,
  condition,
  parts,
}: {
  readonly ambientC: number;
  readonly condition: ThermalCondition;
  readonly parts: Readonly<
    Record<
      | "arteriole"
      | "capillary"
      | "epidermis"
      | "erectorMuscle"
      | "fatLayer"
      | "hairShaft"
      | "sweatGland",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const sweatRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateSkin(condition, ambientC);

  useFrame((_, delta) => {
    if (!playing || sweatRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 2.2;
    sweatRef.current.position.y = 1.02 + ((phaseRef.current * 0.14) % 0.28);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <SkinCamera />
      {/* Subcutaneous fat layer */}
      <mesh castShadow position={[0, 0.14, 0]} receiveShadow>
        <boxGeometry args={[1.7, 0.24, 0.84]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.fatLayer}
          roughness={0.65}
        />
      </mesh>
      {/* Dermis bed */}
      <mesh position={[0, 0.56, 0]}>
        <boxGeometry args={[1.68, 0.6, 0.8]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.epidermis}
          opacity={0.42}
          roughness={0.55}
          transparent
        />
      </mesh>
      {/* Epidermis cap */}
      <mesh castShadow position={[0, 0.92, 0]}>
        <boxGeometry args={[1.7, 0.12, 0.84]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.epidermis}
          roughness={0.5}
        />
      </mesh>
      {/* Arteriole & capillary bed scaling with vasodilation/vasoconstriction */}
      <mesh
        castShadow
        position={[0, 0.42, 0.18]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[reading.arterioleScale, 1, reading.arterioleScale]}
      >
        <cylinderGeometry args={[0.055, 0.055, 1.56, 16]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.arteriole}
          roughness={0.38}
        />
      </mesh>
      <mesh
        position={[0.22, 0.72, 0.22]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[reading.arterioleScale * 0.8, 1, reading.arterioleScale * 0.8]}
      >
        <cylinderGeometry args={[0.032, 0.032, 0.88, 12]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.capillary}
          roughness={0.38}
        />
      </mesh>
      {/* Hair shaft & erector pili muscle */}
      <group
        position={[-0.36, 0.74, 0]}
        rotation={[0, 0, -reading.hairAngleRad]}
      >
        <mesh castShadow position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.025, 0.038, 0.76, 10]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.hairShaft}
            roughness={0.6}
          />
        </mesh>
      </group>
      <mesh position={[-0.18, 0.66, 0.08]} rotation={[0, 0, 0.65]}>
        <cylinderGeometry args={[0.03, 0.03, 0.34, 10]} />
        <meshStandardMaterial
          color={HOMEOSTASIS_COLORS.erectorMuscle}
          roughness={0.5}
        />
      </mesh>
      {/* Sweat gland & active sweat droplet */}
      <group position={[0.48, 0.46, -0.06]}>
        <mesh castShadow>
          <torusKnotGeometry args={[0.1, 0.03, 36, 8]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.sweatGland}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, 0.26, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.44, 10]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.sweatGland}
            roughness={0.4}
          />
        </mesh>
      </group>
      {reading.sweatActive ? (
        <group position={[0.48, 1.04, -0.06]} ref={sweatRef}>
          <mesh>
            <sphereGeometry args={[0.048, 12, 10]} />
            <meshStandardMaterial
              color={HOMEOSTASIS_COLORS.sweatDrop}
              roughness={0.22}
            />
          </mesh>
        </group>
      ) : null}
      {/* Labels */}
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.36, 1.32, 0]}
      >
        <span>{parts.hairShaft}</span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.86, 0.94, 0.26]}
      >
        <span>{parts.epidermis}</span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0.78, 1.04, 0]}
      >
        <span>{parts.sweatGland}</span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0.88, 0.72, 0.24]}
      >
        <span>{parts.capillary}</span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.86, 0.42, 0.28]}
      >
        <span>
          {parts.arteriole} / {parts.erectorMuscle}
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.14, 0.5]}
      >
        <span>{parts.fatLayer}</span>
      </ThreeLabel>
    </group>
  );
}
