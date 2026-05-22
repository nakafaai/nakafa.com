"use client";

import type {
  BiologyLabProps,
  BiologySceneProps,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyLine,
  PulsingGroup,
  RotatingGroup,
  SlidingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

const VIRUS_STAGES = [
  { id: "attach", label: "1", position: [-1.45, 0.24, 0.3] },
  { id: "enter", label: "2", position: [-0.72, 0.08, 0.34] },
  { id: "copy", label: "3", position: [0, -0.08, 0.38] },
  { id: "assemble", label: "4", position: [0.72, 0.08, 0.34] },
  { id: "release", label: "5", position: [1.45, 0.24, 0.3] },
] as const;

const HOST_DNA_PATH = [
  [-0.76, -0.08, 0.38],
  [-0.34, 0.18, 0.38],
  [0.12, -0.08, 0.38],
  [0.54, 0.14, 0.38],
] as const;

/**
 * Renders the viral replication lab with lytic and lysogenic cycle views.
 */
export function VirusReplicationLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={VirusReplicationScene} {...props} />;
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
      <mesh scale={[1.55, 0.95, 0.72]}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial color={colors.host} opacity={0.2} transparent />
      </mesh>

      {VIRUS_STAGES.map((stage, index) => (
        <group key={stage.id} position={stage.position}>
          <RotatingGroup speed={0.3 + index * 0.05}>
            <mesh scale={index < 2 ? 1 : 0.76}>
              <icosahedronGeometry args={[0.16, 1]} />
              <meshStandardMaterial
                color={index < 3 ? colors.pathogen : colors.membrane}
              />
            </mesh>
          </RotatingGroup>
          <SceneLabel
            color={colors.text}
            fontSize="compact"
            position={[0, -0.34, 0]}
          >
            {stage.label}
          </SceneLabel>
        </group>
      ))}

      <SlidingGroup speed={1.2} travel={1.35}>
        <mesh position={[0, 0.62, 0.48]}>
          <icosahedronGeometry args={[0.13, 1]} />
          <meshStandardMaterial color={colors.pathogen} />
        </mesh>
      </SlidingGroup>

      <PulsingGroup speed={1.7} strength={0.08}>
        {[-0.16, 0, 0.16].map((x) => (
          <mesh key={x} position={[x, 0.34, 0.42]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial color={colors.genome} />
          </mesh>
        ))}
      </PulsingGroup>

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
