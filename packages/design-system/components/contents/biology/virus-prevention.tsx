"use client";

import {
  type BiologyLabProps,
  type BiologySceneProps,
  createBiologyGridPoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  PulsingGroup,
  SlidingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

const DROPLETS = createBiologyGridPoints(3, 5);

/**
 * Renders the virus prevention lab with different barriers for different routes.
 */
export function VirusPreventionLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={VirusPreventionScene} {...props} />;
}

/**
 * Compares distance, barrier, and hygiene-immunity interventions as separate visuals.
 */
function VirusPreventionScene({ colors, selectedIndex }: BiologySceneProps) {
  const hasMask = selectedIndex === 1;
  const hasSoap = selectedIndex === 2;
  const dropletScale = selectedIndex === 0 ? 1.05 : 0.52;

  return (
    <group>
      <mesh position={[-1.45, 0, 0]}>
        <sphereGeometry args={[0.34, 32, 16]} />
        <meshStandardMaterial color={colors.host} />
      </mesh>
      <mesh position={[1.45, 0, 0]}>
        <sphereGeometry args={[0.34, 32, 16]} />
        <meshStandardMaterial color={colors.plant} />
      </mesh>

      {hasMask && (
        <mesh position={[-1.08, -0.02, 0.28]} scale={[0.36, 0.18, 0.05]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={colors.ice} />
        </mesh>
      )}

      {hasSoap && (
        <PulsingGroup speed={1.6} strength={0.05}>
          <mesh position={[0, -0.58, 0]} scale={[1.25, 0.12, 0.12]}>
            <capsuleGeometry args={[0.14, 1.5, 6, 16]} />
            <meshStandardMaterial color={colors.ocean} />
          </mesh>
        </PulsingGroup>
      )}

      {DROPLETS.map((point, index) => (
        <SlidingGroup
          key={point.id}
          phase={index * 0.42}
          speed={hasSoap ? 0.45 : 1.2}
          travel={hasMask || hasSoap ? 0.06 : 0.22}
        >
          <mesh
            position={[
              point.position[0] * 0.22,
              point.position[1] * 0.22,
              0.25,
            ]}
            scale={dropletScale}
          >
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshStandardMaterial
              color={hasSoap ? colors.muted : colors.pathogen}
            />
          </mesh>
        </SlidingGroup>
      ))}

      <ArrowHelper
        arrowSize={0.14}
        color={hasMask || hasSoap ? colors.muted : colors.warning}
        from={[-1.05, 0.18, 0.18]}
        lineWidth={3}
        to={[0.95, 0.18, 0.18]}
      />
    </group>
  );
}
