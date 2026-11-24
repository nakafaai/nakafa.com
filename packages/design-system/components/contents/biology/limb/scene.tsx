import { useThree } from "@react-three/fiber";
import type {
  LegMovement,
  LimbKind,
  LimbPart,
  MuscleId,
} from "@repo/design-system/components/contents/biology/limb/model";
import {
  armPairAt,
  legPairFor,
} from "@repo/design-system/components/contents/biology/limb/model";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";

function ankleTiltFor(movement: LegMovement) {
  if (movement === "heel") {
    return -0.45;
  }
  if (movement === "toes") {
    return 0.35;
  }
  return 0;
}

function LimbCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.8] : [0, 1.2, 2.95]}
      cameraTarget={[0.08, 0.72, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.5}
    />
  );
}

export function MusclePairScene({
  angleDeg,
  limb,
  movement,
  muscles,
  parts,
}: {
  readonly angleDeg: number;
  readonly limb: LimbKind;
  readonly movement: LegMovement;
  readonly muscles: Readonly<Record<MuscleId, string>>;
  readonly parts: Readonly<Record<LimbPart, string>>;
}) {
  if (limb === "arm") {
    const pair = armPairAt(angleDeg);
    const flex = 1 - (angleDeg - 35) / 135;
    const forearmRad = ((180 - angleDeg) * Math.PI) / 180;
    const bicepsActive = pair.contracting === "biceps";
    return (
      <group>
        <LimbCamera />
        {/* Humerus */}
        <mesh castShadow position={[0, 1.05, 0]}>
          <capsuleGeometry args={[0.075, 0.75, 10, 14]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.56} />
        </mesh>
        {/* Biceps (front) */}
        <mesh
          castShadow
          position={[0.14, 1.04, 0]}
          scale={[1 + flex * 0.42, 1 - flex * 0.22, 1 + flex * 0.3]}
        >
          <capsuleGeometry args={[0.08, 0.46, 10, 16]} />
          <meshStandardMaterial
            color={
              bicepsActive
                ? SKELETON_COLORS.muscleContract
                : SKELETON_COLORS.muscleRelax
            }
            roughness={0.52}
          />
        </mesh>
        {/* Triceps (back) */}
        <mesh
          castShadow
          position={[-0.14, 1.04, 0]}
          scale={[1.38 - flex * 0.36, 0.8 + flex * 0.2, 1.25 - flex * 0.24]}
        >
          <capsuleGeometry args={[0.075, 0.48, 10, 16]} />
          <meshStandardMaterial
            color={
              bicepsActive
                ? SKELETON_COLORS.muscleRelax
                : SKELETON_COLORS.muscleContract
            }
            roughness={0.52}
          />
        </mesh>
        {/* Tendon */}
        <mesh position={[0.1, 0.68, 0]} rotation={[0, 0, -0.2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.22, 8]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.tendon}
            roughness={0.48}
          />
        </mesh>
        {/* Forearm (radius + ulna) rotating at elbow */}
        <group
          position={[0, 0.62, 0]}
          rotation={[0, 0, forearmRad - Math.PI / 2]}
        >
          <mesh
            castShadow
            position={[0.38, 0.04, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <capsuleGeometry args={[0.042, 0.64, 8, 12]} />
            <meshStandardMaterial
              color={SKELETON_COLORS.bone}
              roughness={0.56}
            />
          </mesh>
          <mesh
            castShadow
            position={[0.36, -0.05, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <capsuleGeometry args={[0.042, 0.68, 8, 12]} />
            <meshStandardMaterial
              color={SKELETON_COLORS.boneSoft}
              roughness={0.58}
            />
          </mesh>
          <ThreeLabel
            color={SKELETON_COLORS.labelInk}
            fontSize="compact"
            position={[0.45, 0.2, 0]}
          >
            <span>{parts.radius}</span>
          </ThreeLabel>
          <ThreeLabel
            color={SKELETON_COLORS.labelInk}
            fontSize="compact"
            position={[0.45, -0.22, 0]}
          >
            <span>{parts.ulna}</span>
          </ThreeLabel>
        </group>

        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[-0.05, 1.54, 0]}
        >
          <span>{parts.humerus}</span>
        </ThreeLabel>
        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[0.44, 1.12, 0]}
        >
          <span>{muscles.biceps}</span>
        </ThreeLabel>
        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[-0.45, 1.08, 0]}
        >
          <span>{muscles.triceps}</span>
        </ThreeLabel>
        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[0.36, 0.7, 0.14]}
        >
          <span>{parts.tendon}</span>
        </ThreeLabel>
      </group>
    );
  }

  const pair = legPairFor(movement);
  const kneeBend = movement === "bend" ? -0.95 : -0.15;
  const ankleTilt = ankleTiltFor(movement);

  return (
    <group>
      <LimbCamera />
      {/* Femur */}
      <mesh castShadow position={[0, 1.16, 0]}>
        <capsuleGeometry args={[0.075, 0.64, 10, 14]} />
        <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.56} />
      </mesh>
      {/* Quadriceps (front thigh) */}
      <mesh castShadow position={[0.13, 1.16, 0]}>
        <capsuleGeometry args={[0.085, 0.44, 10, 14]} />
        <meshStandardMaterial
          color={
            pair.contracting === "quadriceps"
              ? SKELETON_COLORS.muscleContract
              : SKELETON_COLORS.muscleRelax
          }
          roughness={0.52}
        />
      </mesh>
      {/* Hamstrings (back thigh) */}
      <mesh castShadow position={[-0.13, 1.16, 0]}>
        <capsuleGeometry args={[0.08, 0.44, 10, 14]} />
        <meshStandardMaterial
          color={
            pair.contracting === "hamstrings"
              ? SKELETON_COLORS.muscleContract
              : SKELETON_COLORS.muscleRelax
          }
          roughness={0.52}
        />
      </mesh>
      {/* Lower leg rotating at knee */}
      <group position={[0, 0.78, 0]} rotation={[0, 0, kneeBend]}>
        <mesh castShadow position={[0, -0.34, 0]}>
          <capsuleGeometry args={[0.06, 0.58, 10, 14]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.56} />
        </mesh>
        {/* Tibialis anterior (front shin) */}
        <mesh castShadow position={[0.1, -0.32, 0]}>
          <capsuleGeometry args={[0.055, 0.36, 10, 14]} />
          <meshStandardMaterial
            color={
              pair.contracting === "tibialis"
                ? SKELETON_COLORS.muscleContract
                : SKELETON_COLORS.muscleRelax
            }
            roughness={0.52}
          />
        </mesh>
        {/* Gastrocnemius (calf) */}
        <mesh castShadow position={[-0.11, -0.28, 0]}>
          <capsuleGeometry args={[0.075, 0.34, 10, 14]} />
          <meshStandardMaterial
            color={
              pair.contracting === "gastrocnemius"
                ? SKELETON_COLORS.muscleContract
                : SKELETON_COLORS.muscleRelax
            }
            roughness={0.52}
          />
        </mesh>
        {/* Achilles tendon */}
        <mesh position={[-0.08, -0.54, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.22, 8]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.tendon}
            roughness={0.48}
          />
        </mesh>
        {/* Foot */}
        <group position={[0, -0.66, 0]} rotation={[0, 0, ankleTilt]}>
          <mesh castShadow position={[0.1, 0, 0]}>
            <boxGeometry args={[0.34, 0.08, 0.14]} />
            <meshStandardMaterial
              color={SKELETON_COLORS.bone}
              roughness={0.6}
            />
          </mesh>
        </group>
        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[0.36, -0.32, 0]}
        >
          <span>{parts.tibia}</span>
        </ThreeLabel>
      </group>

      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.6, 0]}
      >
        <span>{parts.femur}</span>
      </ThreeLabel>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[0.48, 1.24, 0]}
      >
        <span>{muscles.quadriceps}</span>
      </ThreeLabel>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[-0.48, 1.24, 0]}
      >
        <span>{muscles.hamstrings}</span>
      </ThreeLabel>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[-0.48, 0.42, 0]}
      >
        <span>{muscles.gastrocnemius}</span>
      </ThreeLabel>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[0.46, 0.42, 0]}
      >
        <span>{muscles.tibialis}</span>
      </ThreeLabel>
    </group>
  );
}
