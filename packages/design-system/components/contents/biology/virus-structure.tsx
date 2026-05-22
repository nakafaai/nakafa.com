"use client";

import {
  BIOLOGY_RING_POINT_COUNT,
  type BiologyLabProps,
  type BiologySceneProps,
  createBiologySpherePoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  FloatingGroup,
  PulsingGroup,
  RotatingGroup,
} from "@repo/design-system/components/contents/biology/parts";

const CAPSID_POINTS = createBiologySpherePoints(
  BIOLOGY_RING_POINT_COUNT * 2,
  1.12
);

/**
 * Renders the virus structure lab with capsid, genome, and envelope focus modes.
 */
export function VirusStructureLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={VirusStructureScene} {...props} />;
}

/**
 * Shows that a virion is genetic material packaged in protein, sometimes with an envelope.
 */
function VirusStructureScene({ colors, selectedIndex }: BiologySceneProps) {
  const isCapsidFocus = selectedIndex === 0;
  const isGenomeFocus = selectedIndex === 1;
  const isEnvelopeFocus = selectedIndex === 2;

  return (
    <group>
      <RotatingGroup speed={0.08}>
        <mesh>
          <icosahedronGeometry args={[1, 2]} />
          <meshStandardMaterial
            color={colors.membrane}
            opacity={isCapsidFocus ? 0.58 : 0.22}
            transparent
            wireframe={!isCapsidFocus}
          />
        </mesh>

        {CAPSID_POINTS.map((point) => (
          <mesh key={point.id} position={point.position}>
            <sphereGeometry args={[isCapsidFocus ? 0.13 : 0.08, 16, 16]} />
            <meshStandardMaterial color={colors.pathogen} />
          </mesh>
        ))}

        <PulsingGroup speed={1.8} strength={isGenomeFocus ? 0.08 : 0.03}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusKnotGeometry
              args={[0.45, isGenomeFocus ? 0.055 : 0.03, 96, 8]}
            />
            <meshStandardMaterial color={colors.genome} />
          </mesh>
        </PulsingGroup>

        <mesh visible={isEnvelopeFocus}>
          <sphereGeometry args={[1.34, 48, 32]} />
          <meshStandardMaterial
            color={colors.host}
            opacity={0.18}
            transparent
          />
        </mesh>

        {CAPSID_POINTS.map((point, index) => (
          <FloatingGroup
            key={`spike-${point.id}`}
            phase={index * 0.35}
            travel={0.035}
          >
            <mesh
              position={[
                point.position[0] * 1.18,
                point.position[1] * 1.18,
                point.position[2] * 1.18,
              ]}
              visible={isEnvelopeFocus}
            >
              <sphereGeometry args={[0.075, 12, 10]} />
              <meshStandardMaterial color={colors.microbe} />
            </mesh>
          </FloatingGroup>
        ))}
      </RotatingGroup>
    </group>
  );
}
