"use client";

import {
  BIOLOGY_RING_POINT_COUNT,
  type BiologyLabProps,
  type BiologySceneProps,
  createBiologyRingPoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologySceneTitle,
  RotatingGroup,
} from "@repo/design-system/components/contents/biology/parts";

const CAPSID_POINTS = createBiologyRingPoints(BIOLOGY_RING_POINT_COUNT, 1.18);

/**
 * Renders the virus structure lab with capsid, genome, and envelope focus modes.
 */
export function VirusStructureLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={VirusStructureScene} {...props} />;
}

/**
 * Shows that a virion is genetic material packaged in protein, sometimes with an envelope.
 */
function VirusStructureScene({
  colors,
  item,
  selectedIndex,
}: BiologySceneProps) {
  const isCapsidFocus = selectedIndex === 0;
  const isGenomeFocus = selectedIndex === 1;
  const isEnvelopeFocus = selectedIndex === 2;

  return (
    <group>
      <RotatingGroup>
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

        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusKnotGeometry
            args={[0.45, isGenomeFocus ? 0.055 : 0.03, 96, 8]}
          />
          <meshStandardMaterial color={colors.genome} />
        </mesh>

        <mesh visible={isEnvelopeFocus}>
          <sphereGeometry args={[1.34, 48, 32]} />
          <meshStandardMaterial
            color={colors.host}
            opacity={0.18}
            transparent
          />
        </mesh>

        {CAPSID_POINTS.map((point) => (
          <mesh
            key={`spike-${point.id}`}
            position={[
              point.position[0] * 1.18,
              0.18,
              point.position[2] * 1.18,
            ]}
            visible={isEnvelopeFocus}
          >
            <coneGeometry args={[0.08, 0.28, 12]} />
            <meshStandardMaterial color={colors.microbe} />
          </mesh>
        ))}
      </RotatingGroup>

      <BiologySceneTitle color={colors.text}>{item.label}</BiologySceneTitle>
    </group>
  );
}
