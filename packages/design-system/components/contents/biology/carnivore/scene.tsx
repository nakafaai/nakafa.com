import { useFrame, useThree } from "@react-three/fiber";
import type { SpecialNutritionMode } from "@repo/design-system/components/contents/biology/carnivore/model";
import { evaluateSpecialNutrition } from "@repo/design-system/components/contents/biology/carnivore/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function CarnivoreCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.25] : [0, 1.25, 2.65]}
      cameraTarget={[0, 0.62, 0]}
      fov={38}
      maxDistance={5.6}
      minDistance={1.4}
    />
  );
}

export function CarnivorousPlantScene({
  mode,
  parts,
}: {
  readonly mode: SpecialNutritionMode;
  readonly parts: Readonly<
    Record<
      "aerialRoot" | "haustorium" | "hostStem" | "insect" | "trapLeaf",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const insectRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const profile = evaluateSpecialNutrition(mode);

  const aerialRoots = useMemo(
    () =>
      Arr.makeBy(4, (index) => ({
        id: `ar-${index}`,
        x: 0.24 + index * 0.1,
      })),
    []
  );

  useFrame((_, delta) => {
    if (!playing || insectRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.4;
    const t = phaseRef.current % 1;
    insectRef.current.position.set(
      -0.12 + Math.sin(t * Math.PI * 2) * 0.08,
      1.08 - t * 0.55,
      0.04
    );
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <CarnivoreCamera />
      {profile.trapsInsects ? (
        <group>
          {/* Pitcher trap cup */}
          <mesh castShadow position={[0, 0.56, 0]}>
            <cylinderGeometry args={[0.24, 0.14, 0.72, 20, 1, true]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.carnivorePitcher}
              roughness={0.48}
              side={2}
            />
          </mesh>
          {/* Digestive fluid inside pitcher */}
          <mesh position={[0, 0.32, 0]}>
            <cylinderGeometry args={[0.16, 0.13, 0.24, 18]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.waterBlue}
              opacity={0.55}
              roughness={0.2}
              transparent
            />
          </mesh>
          {/* Lid operculum */}
          <mesh castShadow position={[0, 1.02, -0.14]} rotation={[0.45, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.04, 16]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.healthyLeaf}
              roughness={0.5}
            />
          </mesh>
          {/* Insect drawn into pitcher */}
          <group position={[-0.08, 0.92, 0.04]} ref={insectRef}>
            <mesh>
              <sphereGeometry args={[0.048, 12, 10]} />
              <meshStandardMaterial
                color={BOTANY_COLORS.insectDark}
                roughness={0.4}
              />
            </mesh>
          </group>
          <ThreeLabel
            color={BOTANY_COLORS.labelInk}
            fontSize="compact"
            position={[-0.65, 0.64, 0]}
          >
            <span>{parts.trapLeaf}</span>
          </ThreeLabel>
          <ThreeLabel
            color={BOTANY_COLORS.labelInk}
            fontSize="compact"
            position={[0.58, 0.95, 0]}
          >
            <span>{parts.insect}</span>
          </ThreeLabel>
        </group>
      ) : null}

      {profile.tapsHostVascular ? (
        <group>
          {/* Green host stem */}
          <mesh castShadow position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.14, 0.16, 1.12, 18]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.stemGreen}
              roughness={0.6}
            />
          </mesh>
          {/* Coiling yellow-orange dodder stem */}
          <mesh castShadow position={[0, 0.58, 0]} rotation={[0.2, 0, 0.35]}>
            <torusGeometry args={[0.2, 0.036, 10, 28]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.dodderOrange}
              roughness={0.45}
            />
          </mesh>
          {/* Haustorium penetrating host */}
          <mesh
            castShadow
            position={[0.16, 0.58, 0.08]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <coneGeometry args={[0.055, 0.2, 12]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.dodderOrange}
              roughness={0.4}
            />
          </mesh>
          <ThreeLabel
            color={BOTANY_COLORS.labelInk}
            fontSize="compact"
            position={[-0.66, 0.84, 0]}
          >
            <span>{parts.hostStem}</span>
          </ThreeLabel>
          <ThreeLabel
            color={BOTANY_COLORS.labelInk}
            fontSize="compact"
            position={[0.68, 0.54, 0]}
          >
            <span>{parts.haustorium}</span>
          </ThreeLabel>
        </group>
      ) : null}

      {profile.hasChlorophyll && !profile.trapsInsects ? (
        <group>
          {/* Host tree branch */}
          <mesh
            castShadow
            position={[0, 0.42, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.14, 0.16, 1.6, 16]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.barkBrown}
              roughness={0.85}
            />
          </mesh>
          {/* Epiphytic orchid rosette perched on bark without penetrating */}
          <mesh
            castShadow
            position={[-0.14, 0.72, 0]}
            rotation={[0, 0, 0.5]}
            scale={[1.5, 0.25, 0.7]}
          >
            <sphereGeometry args={[0.18, 12, 10]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.healthyLeaf}
              roughness={0.48}
            />
          </mesh>
          <mesh
            castShadow
            position={[0.14, 0.72, 0]}
            rotation={[0, 0, -0.5]}
            scale={[1.5, 0.25, 0.7]}
          >
            <sphereGeometry args={[0.18, 12, 10]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.healthyLeaf}
              roughness={0.48}
            />
          </mesh>
          {/* Hanging spongy aerial roots */}
          {Arr.map(aerialRoots, (strand) => (
            <mesh key={strand.id} position={[strand.x - 0.36, 0.22, 0.16]}>
              <cylinderGeometry args={[0.018, 0.014, 0.42, 8]} />
              <meshStandardMaterial
                color={BOTANY_COLORS.orchidRoot}
                roughness={0.65}
              />
            </mesh>
          ))}
          <ThreeLabel
            color={BOTANY_COLORS.labelInk}
            fontSize="compact"
            position={[-0.68, 0.46, 0]}
          >
            <span>{parts.hostStem}</span>
          </ThreeLabel>
          <ThreeLabel
            color={BOTANY_COLORS.labelInk}
            fontSize="compact"
            position={[0.66, 0.2, 0]}
          >
            <span>{parts.aerialRoot}</span>
          </ThreeLabel>
        </group>
      ) : null}
    </group>
  );
}
