"use client";

import {
  BIOLOGY_RING_POINT_COUNT,
  type BiologyLabProps,
  type BiologySceneProps,
  type BiologySceneView,
  createBiologySpherePoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  FloatingGroup,
  PulsingGroup,
  RotatingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import {
  createVirusSurfaceAnchors,
  VirusSurfaceSpike,
} from "@repo/design-system/components/contents/biology/virus-parts";

const CAPSID_POINTS = createBiologySpherePoints(
  BIOLOGY_RING_POINT_COUNT * 2,
  0.92
);
const ENVELOPE_SPIKES = createVirusSurfaceAnchors(
  BIOLOGY_RING_POINT_COUNT * 2,
  1.08
);
const VIRION_VIEW = {
  cameraPosition: [2.05, 1.5, 2.85],
  cameraTarget: [0, 0.04, 0],
  narrowCameraPosition: [2.25, 1.72, 3.15],
} satisfies BiologySceneView;

/**
 * Renders the virus structure lab with capsid, genome, and envelope focus modes.
 */
export function VirusStructureLab(props: BiologyLabProps) {
  return (
    <BiologyLabFrame
      scene={VirusStructureScene}
      view={VIRION_VIEW}
      {...props}
    />
  );
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
        <mesh scale={[1.04, 0.96, 1.08]}>
          <sphereGeometry args={[1.1, 56, 36]} />
          <meshStandardMaterial
            color={colors.host}
            opacity={isEnvelopeFocus ? 0.28 : 0.11}
            roughness={0.82}
            transparent
          />
        </mesh>

        <mesh>
          <icosahedronGeometry args={[0.86, 2]} />
          <meshStandardMaterial
            color={colors.membrane}
            opacity={isCapsidFocus ? 0.72 : 0.24}
            roughness={0.72}
            transparent
            wireframe={!isCapsidFocus}
          />
        </mesh>

        {CAPSID_POINTS.map((point) => (
          <mesh key={point.id} position={point.position}>
            <icosahedronGeometry args={[isCapsidFocus ? 0.09 : 0.052, 1]} />
            <meshStandardMaterial color={colors.pathogen} roughness={0.7} />
          </mesh>
        ))}

        <PulsingGroup speed={1.8} strength={isGenomeFocus ? 0.08 : 0.03}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusKnotGeometry
              args={[0.45, isGenomeFocus ? 0.055 : 0.03, 96, 8]}
            />
            <meshStandardMaterial color={colors.genome} roughness={0.52} />
          </mesh>
        </PulsingGroup>

        {ENVELOPE_SPIKES.map((anchor, index) => (
          <FloatingGroup key={anchor.id} phase={index * 0.35} travel={0.035}>
            <VirusSurfaceSpike
              anchor={anchor}
              color={colors.microbe}
              highlighted={isEnvelopeFocus}
            />
          </FloatingGroup>
        ))}
      </RotatingGroup>
    </group>
  );
}
