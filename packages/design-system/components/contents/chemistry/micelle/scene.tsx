import { useFrame, useThree } from "@react-three/fiber";
import type {
  MicelleStage,
  WaterType,
} from "@repo/design-system/components/contents/chemistry/micelle/model";
import { evaluateMicelleCleaning } from "@repo/design-system/components/contents/chemistry/micelle/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function MicelleCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.35] : [0, 1.28, 2.7]}
      cameraTarget={[0, 0.54, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function SoapMicelleScene({
  parts,
  stage,
  waterType,
}: {
  readonly parts: Readonly<
    Record<
      | "fabric"
      | "greaseDrop"
      | "hydrophilicHead"
      | "hydrophobicTail"
      | "waterFlow",
      string
    >
  >;
  readonly stage: MicelleStage;
  readonly waterType: WaterType;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const micelleRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const pose = evaluateMicelleCleaning(stage, waterType);

  const surfactants = useMemo(
    () =>
      Arr.makeBy(pose.soapCount, (index) => ({
        angle: (index / Math.max(1, pose.soapCount)) * Math.PI * 2,
        id: `s-${index}`,
      })),
    [pose.soapCount]
  );

  useFrame((_, delta) => {
    if (!playing || micelleRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.1;
    micelleRef.current.rotation.z =
      stage === "rinseAway"
        ? phaseRef.current * 0.5
        : Math.sin(phaseRef.current) * 0.14;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <MicelleCamera />
      {/* Woven fabric slab at base */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[1.9, 0.14, 0.9]} />
        <meshStandardMaterial
          color={ORGANIC_COLORS.fabricSlate}
          roughness={0.8}
        />
      </mesh>
      {/* Grease droplet surrounded by amphiphilic soap anions */}
      <group position={[0, pose.dropletY, 0]} ref={micelleRef}>
        <mesh castShadow>
          <sphereGeometry args={[0.2, 18, 14]} />
          <meshStandardMaterial
            color={ORGANIC_COLORS.greaseOlive}
            roughness={0.45}
          />
        </mesh>
        {Arr.map(surfactants, (unit) => {
          const rx = Math.cos(unit.angle);
          const ry = Math.sin(unit.angle);
          return (
            <group key={unit.id}>
              {/* Hydrophobic tail pointing inward */}
              <mesh
                position={[rx * 0.25, ry * 0.25, 0]}
                rotation={[0, 0, unit.angle - Math.PI / 2]}
              >
                <cylinderGeometry args={[0.015, 0.015, 0.14, 8]} />
                <meshStandardMaterial color={ORGANIC_COLORS.hydrophobicAmber} />
              </mesh>
              {/* Hydrophilic anionic head pointing outward into water */}
              <mesh position={[rx * 0.34, ry * 0.34, 0]}>
                <sphereGeometry args={[0.044, 10, 10]} />
                <meshStandardMaterial
                  color={
                    pose.hasScum
                      ? ORGANIC_COLORS.scumGray
                      : ORGANIC_COLORS.hydrophilicBlue
                  }
                />
              </mesh>
            </group>
          );
        })}
      </group>
      {/* Labels */}
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 0.16, 0.45]}
      >
        <span>{parts.fabric}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[-0.68, pose.dropletY + 0.14, 0]}
      >
        <span>{parts.greaseDrop}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.74, pose.dropletY + 0.3, 0]}
      >
        <span>{parts.hydrophilicHead}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.74, pose.dropletY - 0.14, 0]}
      >
        <span>{parts.hydrophobicTail}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.12, 0]}
      >
        <span>{parts.waterFlow}</span>
      </ThreeLabel>
    </group>
  );
}
