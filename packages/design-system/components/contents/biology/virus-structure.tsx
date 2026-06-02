"use client";

import { BiologyCallouts } from "@repo/design-system/components/contents/biology/callouts";
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
  BacteriophageModel,
  createVirusSurfaceAnchors,
  EnvelopedVirusModel,
  HelicalVirusModel,
  PolyhedralVirusModel,
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
const MORPHOLOGY_VIEW = {
  cameraPosition: [0, 1.04, 4.72],
  cameraTarget: [0, -0.02, 0],
  narrowCameraPosition: [0, 1.28, 5.55],
} satisfies BiologySceneView;
const MORPHOLOGY_LABEL_TARGETS = [
  { id: "helical", labelPosition: [-2.2, -0.86, -0.52] },
  { id: "polyhedral", labelPosition: [-0.72, -0.86, -0.16] },
  { id: "enveloped", labelPosition: [0.86, -0.86, 0.18] },
  { id: "complex", labelPosition: [2.24, -0.86, 0.52] },
] as const;

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
 * Renders major virus morphology types as distinct reusable 3D assets.
 */
export function VirusMorphologyLab(props: BiologyLabProps) {
  return (
    <BiologyLabFrame
      scene={VirusMorphologyScene}
      view={MORPHOLOGY_VIEW}
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

/**
 * Places the four common viral morphologies side by side without extra tabs.
 */
function VirusMorphologyScene({ colors, item }: BiologySceneProps) {
  return (
    <group>
      <group position={[-2.2, 0.08, -0.52]} rotation={[0.08, -0.24, 0.08]}>
        <HelicalVirusModel colors={colors} scale={1.04} />
      </group>
      <group position={[-0.72, 0.06, -0.16]} rotation={[0.18, 0.3, -0.08]}>
        <PolyhedralVirusModel colors={colors} scale={1.02} />
      </group>
      <group position={[0.86, 0.07, 0.18]} rotation={[0.12, -0.25, 0]}>
        <EnvelopedVirusModel colors={colors} scale={0.92} />
      </group>
      <group position={[2.24, 0.02, 0.52]} rotation={[0.12, 0.22, -0.06]}>
        <BacteriophageModel colors={colors} scale={0.98} />
      </group>
      <BiologyCallouts
        callouts={item.callouts}
        color={colors.text}
        targets={MORPHOLOGY_LABEL_TARGETS}
      />
    </group>
  );
}
