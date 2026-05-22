"use client";

import type {
  BiologyLabProps,
  BiologySceneProps,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import { BiologySceneTitle } from "@repo/design-system/components/contents/biology/parts";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

const VIRUS_STAGES = [
  { id: "attach", virusX: -1.35, genomeX: -1.35, particles: 1 },
  { id: "enter", virusX: -0.55, genomeX: -0.18, particles: 1 },
  { id: "copy", virusX: 0, genomeX: 0, particles: 4 },
  { id: "assemble", virusX: 0.55, genomeX: 0.55, particles: 7 },
  { id: "release", virusX: 1.35, genomeX: 1.35, particles: 9 },
] as const;

/**
 * Renders the viral replication lab with a real stage-by-stage 3D transition.
 */
export function VirusReplicationLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={VirusReplicationScene} {...props} />;
}

/**
 * Shows attachment, entry, copying, assembly, and release inside one host cell.
 */
function VirusReplicationScene({
  colors,
  item,
  selectedIndex,
}: BiologySceneProps) {
  const stage = VIRUS_STAGES[selectedIndex] ?? VIRUS_STAGES[0];
  const particles = Array.from({ length: stage.particles }, (_, index) => {
    const angle = (index / stage.particles) * Math.PI * 2;

    return {
      id: `particle-${index}`,
      position: [Math.cos(angle) * 0.62, Math.sin(angle) * 0.34, 0.18] as const,
    };
  });

  return (
    <group>
      <mesh scale={[1.55, 0.95, 0.72]}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial color={colors.host} opacity={0.2} transparent />
      </mesh>

      <mesh position={[stage.virusX, 0.16, 0.35]}>
        <icosahedronGeometry args={[0.22, 1]} />
        <meshStandardMaterial color={colors.pathogen} />
      </mesh>

      <mesh
        position={[stage.genomeX, -0.08, 0.42]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusKnotGeometry args={[0.2, 0.025, 64, 6]} />
        <meshStandardMaterial color={colors.genome} />
      </mesh>

      {particles.map((particle) => (
        <mesh key={particle.id} position={particle.position}>
          <icosahedronGeometry args={[0.13, 1]} />
          <meshStandardMaterial color={colors.membrane} />
        </mesh>
      ))}

      <ArrowHelper
        arrowSize={0.14}
        color={colors.arrow}
        from={[-1.55, -0.8, 0]}
        lineWidth={3}
        to={[1.55, -0.8, 0]}
      />

      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[stage.virusX, 0.75, 0.1]}
      >
        {String(selectedIndex + 1)}
      </SceneLabel>

      <BiologySceneTitle color={colors.text}>{item.label}</BiologySceneTitle>
    </group>
  );
}
