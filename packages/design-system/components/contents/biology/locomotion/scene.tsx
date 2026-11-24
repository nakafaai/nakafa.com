import { useFrame, useThree } from "@react-three/fiber";
import type {
  LocomotionAnimal,
  LocomotionMuscle,
  LocomotionPart,
} from "@repo/design-system/components/contents/biology/locomotion/model";
import { activeMuscleAt } from "@repo/design-system/components/contents/biology/locomotion/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr, Match } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const WORM_SEGMENTS = [-0.6, -0.36, -0.12, 0.12, 0.36, 0.6] as const;

function LocomotionCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.8, 3.85] : [0, 1.45, 3.05]}
      cameraTarget={[0, 0.42, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.5}
    />
  );
}

function EarthwormView({
  activeMuscle,
  parts,
}: {
  readonly activeMuscle: LocomotionMuscle;
  readonly parts: Readonly<Record<LocomotionPart, string>>;
}) {
  const elongated = activeMuscle === "circular";
  return (
    <group>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[2.6, 0.08, 1.4]} />
        <meshStandardMaterial color={SKELETON_COLORS.soil} roughness={0.94} />
      </mesh>
      {Arr.map(WORM_SEGMENTS, (x, idx) => {
        const stretch = idx % 2 === 0 ? elongated : !elongated;
        return (
          <group key={x} position={[x * (elongated ? 1.08 : 0.92), 0.18, 0]}>
            <mesh
              castShadow
              rotation={[0, 0, Math.PI / 2]}
              scale={[
                stretch ? 0.82 : 1.24,
                stretch ? 1.28 : 0.8,
                stretch ? 0.82 : 1.24,
              ]}
            >
              <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
              <meshStandardMaterial
                color={
                  stretch
                    ? SKELETON_COLORS.muscleContract
                    : SKELETON_COLORS.wormBody
                }
                roughness={0.58}
              />
            </mesh>
            {stretch ? null : (
              <mesh position={[0, -0.12, 0]}>
                <coneGeometry args={[0.02, 0.07, 6]} />
                <meshStandardMaterial
                  color={SKELETON_COLORS.wormChaetae}
                  roughness={0.8}
                />
              </mesh>
            )}
          </group>
        );
      })}
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.56, 0]}
      >
        <span>{parts.fluid}</span>
      </ThreeLabel>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[0.35, 0.08, 0.45]}
      >
        <span>{parts.chaetae}</span>
      </ThreeLabel>
    </group>
  );
}

function FishView({
  activeMuscle,
  parts,
}: {
  readonly activeMuscle: LocomotionMuscle;
  readonly parts: Readonly<Record<LocomotionPart, string>>;
}) {
  const bend = activeMuscle === "left" ? 0.22 : -0.22;
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[2.6, 0.9, 1.4]} />
        <meshPhysicalMaterial
          color={SKELETON_COLORS.waterMedium}
          opacity={0.18}
          roughness={0.15}
          transparent
        />
      </mesh>
      <group position={[0, 0.48, 0]} rotation={[0, bend, 0]}>
        <mesh
          castShadow
          rotation={[0, 0, Math.PI / 2]}
          scale={[0.5, 1.6, 0.35]}
        >
          <sphereGeometry args={[0.26, 22, 16]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.fishBody}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, 0, 0.12]} scale={[0.6, 0.45, 0.22]}>
          <boxGeometry args={[0.65, 0.26, 0.14]} />
          <meshStandardMaterial
            color={
              activeMuscle === "left"
                ? SKELETON_COLORS.muscleContract
                : SKELETON_COLORS.muscleRelax
            }
            roughness={0.5}
          />
        </mesh>
        <mesh position={[0, 0, -0.12]} scale={[0.6, 0.45, 0.22]}>
          <boxGeometry args={[0.65, 0.26, 0.14]} />
          <meshStandardMaterial
            color={
              activeMuscle === "right"
                ? SKELETON_COLORS.muscleContract
                : SKELETON_COLORS.muscleRelax
            }
            roughness={0.5}
          />
        </mesh>
        <mesh
          castShadow
          position={[-0.58, 0, -bend * 0.4]}
          rotation={[0, -bend * 1.4, Math.PI / 2]}
        >
          <coneGeometry args={[0.22, 0.34, 8]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.fishFin}
            roughness={0.4}
          />
        </mesh>
      </group>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[0.1, 0.85, 0.22]}
      >
        <span>{parts.myotome}</span>
      </ThreeLabel>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 0.78, 0]}
      >
        <span>{parts.fin}</span>
      </ThreeLabel>
    </group>
  );
}

function GrasshopperView({
  activeMuscle,
  parts,
}: {
  readonly activeMuscle: LocomotionMuscle;
  readonly parts: Readonly<Record<LocomotionPart, string>>;
}) {
  const kicking = activeMuscle === "extensor";
  return (
    <group>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[2.6, 0.06, 1.4]} />
        <meshStandardMaterial
          color={SKELETON_COLORS.groundMeadow}
          roughness={0.9}
        />
      </mesh>
      <group position={[0, kicking ? 0.56 : 0.28, 0]}>
        <mesh
          castShadow
          rotation={[0, 0, Math.PI / 2]}
          scale={[0.42, 1.5, 0.48]}
        >
          <capsuleGeometry args={[0.18, 0.45, 10, 14]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.grasshopperBody}
            roughness={0.5}
          />
        </mesh>
        {/* Hind femur */}
        <mesh castShadow position={[-0.14, 0.12, 0.18]} rotation={[0, 0, 0.65]}>
          <capsuleGeometry args={[0.075, 0.46, 8, 12]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.grasshopperExoskeleton}
            roughness={0.48}
          />
        </mesh>
        {/* Extensor muscle highlight inside femur */}
        <mesh position={[-0.14, 0.14, 0.23]} rotation={[0, 0, 0.65]}>
          <capsuleGeometry args={[0.04, 0.32, 8, 10]} />
          <meshStandardMaterial
            color={
              kicking
                ? SKELETON_COLORS.muscleContract
                : SKELETON_COLORS.muscleRelax
            }
            roughness={0.5}
          />
        </mesh>
        {/* Hind tibia */}
        <mesh
          castShadow
          position={[-0.34, kicking ? -0.18 : 0.02, 0.18]}
          rotation={[0, 0, kicking ? -0.4 : 0.72]}
        >
          <cylinderGeometry args={[0.024, 0.018, 0.52, 8]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.grasshopperExoskeleton}
            roughness={0.48}
          />
        </mesh>
      </group>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[-0.1, 0.96, 0.2]}
      >
        <span>{parts.femur}</span>
      </ThreeLabel>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[-0.64, 0.32, 0.24]}
      >
        <span>{parts.tibia}</span>
      </ThreeLabel>
    </group>
  );
}

function BirdView({
  activeMuscle,
  parts,
}: {
  readonly activeMuscle: LocomotionMuscle;
  readonly parts: Readonly<Record<LocomotionPart, string>>;
}) {
  const downstroke = activeMuscle === "pectoralis";
  const wingAngle = downstroke ? -0.45 : 0.52;
  return (
    <group position={[0, 0.62, 0]}>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} scale={[0.55, 1.3, 0.55]}>
        <sphereGeometry args={[0.24, 20, 14]} />
        <meshStandardMaterial
          color={SKELETON_COLORS.birdBody}
          roughness={0.55}
        />
      </mesh>
      {/* Sternum keel */}
      <mesh castShadow position={[0.04, -0.18, 0]}>
        <boxGeometry args={[0.36, 0.12, 0.05]} />
        <meshStandardMaterial
          color={SKELETON_COLORS.keelBone}
          roughness={0.52}
        />
      </mesh>
      {/* Pectoralis highlight */}
      <mesh position={[0.04, -0.12, 0.1]}>
        <sphereGeometry args={[0.09, 14, 10]} />
        <meshStandardMaterial
          color={
            downstroke
              ? SKELETON_COLORS.muscleContract
              : SKELETON_COLORS.muscleRelax
          }
          roughness={0.52}
        />
      </mesh>
      {/* Wings */}
      <mesh castShadow position={[0, 0.06, 0.42]} rotation={[wingAngle, 0, 0]}>
        <boxGeometry args={[0.32, 0.04, 0.85]} />
        <meshStandardMaterial
          color={SKELETON_COLORS.birdWing}
          roughness={0.5}
        />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.06, -0.42]}
        rotation={[-wingAngle, 0, 0]}
      >
        <boxGeometry args={[0.32, 0.04, 0.85]} />
        <meshStandardMaterial
          color={SKELETON_COLORS.birdWing}
          roughness={0.5}
        />
      </mesh>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[0.05, -0.36, 0.14]}
      >
        <span>{parts.keel}</span>
      </ThreeLabel>
    </group>
  );
}

export function LocomotionScene({
  activeMuscle,
  animal,
  onMuscleChange,
  parts,
}: {
  readonly activeMuscle: LocomotionMuscle;
  readonly animal: LocomotionAnimal;
  readonly onMuscleChange: (next: LocomotionMuscle) => void;
  readonly parts: Readonly<Record<LocomotionPart, string>>;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRef(0);
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current = (clock.current + simulationStep(delta) * 0.55) % 1;
    const next = activeMuscleAt(animal, clock.current);
    if (next !== activeMuscle) {
      onMuscleChange(next);
    }
  });

  return (
    <group ref={groupRef}>
      <SimulationTicker running={playing} />
      <LocomotionCamera />
      {Match.value(animal).pipe(
        Match.when("earthworm", () => (
          <EarthwormView activeMuscle={activeMuscle} parts={parts} />
        )),
        Match.when("fish", () => (
          <FishView activeMuscle={activeMuscle} parts={parts} />
        )),
        Match.when("grasshopper", () => (
          <GrasshopperView activeMuscle={activeMuscle} parts={parts} />
        )),
        Match.when("bird", () => (
          <BirdView activeMuscle={activeMuscle} parts={parts} />
        )),
        Match.exhaustive
      )}
    </group>
  );
}
