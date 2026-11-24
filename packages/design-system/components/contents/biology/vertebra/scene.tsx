import { useFrame, useThree } from "@react-three/fiber";
import type {
  VertebraPart,
  VertebraRegion,
} from "@repo/design-system/components/contents/biology/vertebra/model";
import { vertebraSpecOf } from "@repo/design-system/components/contents/biology/vertebra/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const COLUMN_LEVELS = [
  { region: "caudal", width: 0.08, y: 0.08, z: -0.02 },
  { region: "sacral", width: 0.16, y: 0.24, z: -0.06 },
  { region: "lumbar", width: 0.2, y: 0.44, z: 0.04 },
  { region: "lumbar", width: 0.19, y: 0.58, z: 0.06 },
  { region: "thoracic", width: 0.16, y: 0.76, z: -0.04 },
  { region: "thoracic", width: 0.15, y: 0.92, z: -0.08 },
  { region: "thoracic", width: 0.14, y: 1.08, z: -0.05 },
  { region: "cervical", width: 0.12, y: 1.28, z: 0.04 },
  { region: "axis", width: 0.11, y: 1.44, z: 0.03 },
  { region: "atlas", width: 0.11, y: 1.56, z: 0.02 },
] as const;

function VertebraCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.45, 3.8] : [0, 1.2, 2.95]}
      cameraTarget={[0.1, 0.82, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.5}
    />
  );
}

export function VertebraScene({
  parts,
  region,
}: {
  readonly parts: Readonly<Record<VertebraPart, string>>;
  readonly region: VertebraRegion;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const liftedRef = useRef<Group>(null);
  const spec = vertebraSpecOf(region);

  useFrame((_, delta) => {
    const lifted = liftedRef.current;
    if (lifted === null || !playing) {
      return;
    }
    lifted.rotation.y += simulationStep(delta) * 0.65;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <VertebraCamera />
      {/* Curved vertebral column on the left */}
      <group position={[-0.78, 0, 0]}>
        {Arr.map(COLUMN_LEVELS, (item) => {
          const active = item.region === region;
          return (
            <group
              key={`${item.region}-${item.y}`}
              position={[0, item.y, item.z]}
            >
              <mesh castShadow>
                <cylinderGeometry
                  args={[item.width, item.width * 1.05, 0.1, 16]}
                />
                <meshStandardMaterial
                  color={
                    active
                      ? SKELETON_COLORS.regionActive
                      : SKELETON_COLORS.regionNeutral
                  }
                  roughness={0.55}
                />
              </mesh>
              <mesh position={[0, 0.06, 0]}>
                <cylinderGeometry
                  args={[item.width * 0.92, item.width * 0.92, 0.025, 14]}
                />
                <meshStandardMaterial
                  color={SKELETON_COLORS.disc}
                  roughness={0.45}
                />
              </mesh>
            </group>
          );
        })}
        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[-0.36, 0.64, 0.08]}
        >
          <span>{parts.disc}</span>
        </ThreeLabel>
      </group>

      {/* Enlarged lifted vertebra on the right */}
      <group position={[0.65, 0.85, 0]} ref={liftedRef}>
        {spec.hasBody ? (
          <mesh castShadow position={[0, 0, 0.22]}>
            <cylinderGeometry
              args={[spec.bodyRadius, spec.bodyRadius, 0.22, 24]}
            />
            <meshStandardMaterial
              color={SKELETON_COLORS.bone}
              roughness={0.52}
            />
          </mesh>
        ) : null}
        {/* Neural arch & canal */}
        <mesh
          castShadow
          position={[0, 0, -0.04]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.18, 0.055, 12, 24]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.52} />
        </mesh>
        <mesh position={[0, 0, -0.04]}>
          <cylinderGeometry args={[0.1, 0.1, 0.12, 16]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.canal}
            roughness={0.85}
          />
        </mesh>
        {/* Transverse processes */}
        <mesh
          castShadow
          position={[-0.3, 0, -0.02]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <capsuleGeometry args={[0.042, 0.22, 8, 12]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.52} />
        </mesh>
        <mesh
          castShadow
          position={[0.3, 0, -0.02]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <capsuleGeometry args={[0.042, 0.22, 8, 12]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.52} />
        </mesh>
        {/* Spinous process */}
        <mesh
          castShadow
          position={[0, -0.04, -0.26 - spec.spinousLength / 2]}
          rotation={[Math.PI / 2 + 0.25, 0, 0]}
        >
          <capsuleGeometry args={[0.038, spec.spinousLength, 8, 12]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.52} />
        </mesh>
        {/* Optional dens (axis), foramen (cervical), or rib facet (thoracic) */}
        {spec.hasDens ? (
          <mesh castShadow position={[0, 0.22, 0.22]}>
            <capsuleGeometry args={[0.052, 0.16, 8, 12]} />
            <meshStandardMaterial
              color={SKELETON_COLORS.regionActive}
              roughness={0.48}
            />
          </mesh>
        ) : null}
        {spec.hasForamen ? (
          <mesh position={[0.3, 0.04, -0.02]}>
            <cylinderGeometry args={[0.028, 0.028, 0.06, 12]} />
            <meshStandardMaterial
              color={SKELETON_COLORS.canal}
              roughness={0.8}
            />
          </mesh>
        ) : null}
        {spec.hasFacet ? (
          <mesh position={[0.22, 0.04, 0.16]}>
            <sphereGeometry args={[0.045, 12, 10]} />
            <meshStandardMaterial
              color={SKELETON_COLORS.cartilage}
              roughness={0.38}
            />
          </mesh>
        ) : null}

        {spec.hasBody ? (
          <ThreeLabel
            color={SKELETON_COLORS.labelInk}
            fontSize="compact"
            position={[0, 0.24, 0.34]}
          >
            <span>{parts.body}</span>
          </ThreeLabel>
        ) : null}
        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[0, 0.32, -0.04]}
        >
          <span>{parts.canal}</span>
        </ThreeLabel>
        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[0, -0.24, -0.42]}
        >
          <span>{parts.spinous}</span>
        </ThreeLabel>
        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[-0.46, 0.18, -0.02]}
        >
          <span>{parts.transverse}</span>
        </ThreeLabel>
        {spec.hasForamen ? (
          <ThreeLabel
            color={SKELETON_COLORS.labelInk}
            fontSize="compact"
            position={[0.5, 0.18, -0.02]}
          >
            <span>{parts.foramen}</span>
          </ThreeLabel>
        ) : null}
        {spec.hasFacet ? (
          <ThreeLabel
            color={SKELETON_COLORS.labelInk}
            fontSize="compact"
            position={[0.45, 0.22, 0.2]}
          >
            <span>{parts.facet}</span>
          </ThreeLabel>
        ) : null}
        {spec.hasDens ? (
          <ThreeLabel
            color={SKELETON_COLORS.labelInk}
            fontSize="compact"
            position={[0.16, 0.44, 0.24]}
          >
            <span>{parts.dens}</span>
          </ThreeLabel>
        ) : null}
      </group>
    </group>
  );
}
