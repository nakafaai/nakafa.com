"use client";

import type {
  BiologyLabProps,
  BiologySceneProps,
  BiologySceneView,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyLine,
  PulsingGroup,
  RotatingGroup,
  SlidingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import {
  BacteriophageModel,
  MiniEnvelopedVirion,
} from "@repo/design-system/components/contents/biology/virus-parts";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

const VIRUS_STAGES = [
  { id: "attach", position: [-1.28, 0.32, 0.36] },
  { id: "enter", position: [-0.58, 0.08, 0.38] },
  { id: "copy", position: [0, -0.04, 0.4] },
  { id: "assemble", position: [0.58, 0.08, 0.38] },
  { id: "release", position: [1.28, 0.32, 0.36] },
] as const;

const HOST_DNA_PATH = [
  [-0.76, -0.08, 0.38],
  [-0.34, 0.18, 0.38],
  [0.12, -0.08, 0.38],
  [0.54, 0.14, 0.38],
] as const;
const REPLICATION_VIEW = {
  cameraPosition: [0, 1.62, 3.05],
  cameraTarget: [0, -0.06, 0.18],
  narrowCameraPosition: [0, 1.85, 3.55],
} satisfies BiologySceneView;

/**
 * Renders the viral replication lab with lytic and lysogenic cycle views.
 */
export function VirusReplicationLab(props: BiologyLabProps) {
  return (
    <BiologyLabFrame
      scene={VirusReplicationScene}
      view={REPLICATION_VIEW}
      {...props}
    />
  );
}

/**
 * Switches between immediate virion production and genome dormancy.
 */
function VirusReplicationScene({ colors, selectedIndex }: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <LysogenicCycle colors={colors} />;
  }

  return <LyticCycle colors={colors} />;
}

/**
 * Shows the full lytic cycle at once so students do not need five separate tabs.
 */
function LyticCycle({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} scale={[0.88, 1.5, 0.68]}>
        <capsuleGeometry args={[0.62, 1.22, 14, 34]} />
        <meshStandardMaterial color={colors.host} opacity={0.2} transparent />
      </mesh>

      {VIRUS_STAGES.map((stage, index) => (
        <group key={stage.id} position={stage.position}>
          <RotatingGroup speed={0.3 + index * 0.05}>
            {index < 2 ? (
              <BacteriophageModel colors={colors} scale={0.52} />
            ) : (
              <MiniEnvelopedVirion colors={colors} scale={0.58} />
            )}
          </RotatingGroup>
        </group>
      ))}

      <SlidingGroup speed={1.2} travel={1.35}>
        <group position={[0, 0.72, 0.5]} rotation={[0, 0, -0.7]}>
          <BacteriophageModel colors={colors} scale={0.42} />
        </group>
      </SlidingGroup>

      <PulsingGroup speed={1.7} strength={0.08}>
        {[-0.16, 0, 0.16].map((x) => (
          <mesh key={x} position={[x, 0.34, 0.42]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial color={colors.genome} />
          </mesh>
        ))}
      </PulsingGroup>

      <BiologyLine
        color={colors.warning}
        lineWidth={3}
        points={[
          [1.02, 0.06, 0.5],
          [1.18, -0.1, 0.52],
          [1.36, 0.02, 0.5],
        ]}
      />

      <ArrowHelper
        arrowSize={0.14}
        color={colors.arrow}
        from={[-1.55, -0.8, 0]}
        lineWidth={3}
        to={[1.55, -0.8, 0]}
      />
    </group>
  );
}

/**
 * Shows a viral genome carried quietly with the host genome before activation.
 */
function LysogenicCycle({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} scale={[0.8, 1.3, 0.8]}>
        <capsuleGeometry args={[0.48, 1.36, 12, 30]} />
        <meshStandardMaterial color={colors.host} opacity={0.24} transparent />
      </mesh>

      <PulsingGroup speed={1.3} strength={0.04}>
        <BiologyLine
          color={colors.genome}
          lineWidth={4}
          points={HOST_DNA_PATH}
        />
      </PulsingGroup>

      <RotatingGroup speed={0.22}>
        <mesh position={[0.12, 0, 0.44]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.22, 0.022, 8, 48]} />
          <meshStandardMaterial color={colors.pathogen} />
        </mesh>
      </RotatingGroup>

      {[-0.8, 0.82].map((x) => (
        <mesh
          key={x}
          position={[x, -0.58, 0.24]}
          rotation={[0, 0, Math.PI / 2]}
          scale={[0.32, 0.52, 0.32]}
        >
          <capsuleGeometry args={[0.3, 0.62, 8, 18]} />
          <meshStandardMaterial
            color={colors.microbe}
            opacity={0.7}
            transparent
          />
        </mesh>
      ))}

      <ArrowHelper
        arrowSize={0.12}
        color={colors.arrow}
        from={[-0.36, -0.58, 0.22]}
        to={[0.36, -0.58, 0.22]}
      />
    </group>
  );
}
