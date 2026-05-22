"use client";

import type {
  BiologyLabProps,
  BiologySceneColors,
  BiologySceneProps,
  BiologySceneView,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyLine,
  PulsingGroup,
  RotatingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import { BacteriophageModel } from "@repo/design-system/components/contents/biology/virus-parts";

const VIRUS_STAGES = [
  { id: "attach", position: [-1.26, 0.42, 0.36] },
  { id: "enter", position: [-0.62, 0.18, 0.38] },
  { id: "assemble", position: [0.58, 0.06, 0.4] },
  { id: "release", position: [1.52, 0.32, 0.42] },
] as const;

const VIRAL_GENOME_ENTRY_PATH = [
  [-0.78, 0.24, 0.5],
  [-0.54, 0.1, 0.5],
  [-0.28, 0.12, 0.5],
] as const;
const VIRAL_PART_GENOME_STRAND = [
  [-0.1, 0, 0],
  [-0.03, 0.04, 0.02],
  [0.06, -0.02, 0.01],
  [0.12, 0.03, 0],
] as const;
const VIRAL_PARTS = [
  {
    id: "capsid-a",
    kind: "capsid",
    position: [-0.16, 0.22, 0.48],
    scale: 0.9,
  },
  {
    id: "capsid-b",
    kind: "capsid",
    position: [0.02, 0.28, 0.5],
    scale: 0.78,
  },
  {
    id: "capsid-c",
    kind: "capsid",
    position: [0.18, 0.18, 0.49],
    scale: 0.7,
  },
  {
    id: "genome-a",
    kind: "genome",
    position: [-0.04, 0.02, 0.48],
    scale: 0.9,
  },
  {
    id: "genome-b",
    kind: "genome",
    position: [0.16, -0.02, 0.5],
    scale: 0.72,
  },
] as const;
const LYSOGENIC_HOST_DNA = [
  [-0.74, 0.08, 0.42],
  [-0.42, 0.28, 0.42],
  [-0.08, 0.08, 0.42],
  [0.28, 0.28, 0.42],
  [0.62, 0.08, 0.42],
] as const;
const INTEGRATED_VIRAL_GENOME = [
  [-0.08, 0.08, 0.44],
  [0.02, -0.02, 0.46],
  [0.16, 0.06, 0.44],
] as const;
const DAUGHTER_CELLS = [
  { id: "left", position: [-0.72, -0.42, 0.24] },
  { id: "right", position: [0.72, -0.42, 0.24] },
] as const;
const REPLICATION_VIEW = {
  cameraPosition: [0, 1.56, 3.02],
  cameraTarget: [0, -0.06, 0.18],
  narrowCameraPosition: [0, 1.88, 3.48],
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
            <BacteriophageModel
              colors={colors}
              scale={index < 2 ? 0.52 : 0.44}
            />
          </RotatingGroup>
        </group>
      ))}

      <PulsingGroup speed={1.5} strength={0.05}>
        <BiologyLine
          color={colors.genome}
          lineWidth={4}
          points={VIRAL_GENOME_ENTRY_PATH}
        />
      </PulsingGroup>

      <PulsingGroup speed={1.7} strength={0.05}>
        {VIRAL_PARTS.map((part) => (
          <ViralPart colors={colors} key={part.id} part={part} />
        ))}
      </PulsingGroup>
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
          points={LYSOGENIC_HOST_DNA}
        />
        <BiologyLine
          color={colors.pathogen}
          lineWidth={5}
          points={INTEGRATED_VIRAL_GENOME}
        />
      </PulsingGroup>

      {DAUGHTER_CELLS.map((cell) => (
        <DaughterCell colors={colors} key={cell.id} position={cell.position} />
      ))}
    </group>
  );
}

/**
 * Renders copied viral parts as capsids and genome strands, not loose dots.
 */
function ViralPart({
  colors,
  part,
}: {
  colors: BiologySceneColors;
  part: (typeof VIRAL_PARTS)[number];
}) {
  if (part.kind === "capsid") {
    return (
      <mesh position={part.position} scale={part.scale}>
        <icosahedronGeometry args={[0.08, 1]} />
        <meshStandardMaterial color={colors.pathogen} roughness={0.72} />
      </mesh>
    );
  }

  return (
    <group position={part.position} scale={part.scale}>
      <BiologyLine
        color={colors.genome}
        lineWidth={2.8}
        points={VIRAL_PART_GENOME_STRAND}
      />
    </group>
  );
}

/**
 * Shows daughter host cells carrying both host DNA and integrated viral genome.
 */
function DaughterCell({
  colors,
  position,
}: {
  colors: BiologySceneColors;
  position: (typeof DAUGHTER_CELLS)[number]["position"];
}) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} scale={[0.28, 0.5, 0.28]}>
        <capsuleGeometry args={[0.3, 0.62, 8, 18]} />
        <meshStandardMaterial
          color={colors.microbe}
          opacity={0.72}
          transparent
        />
      </mesh>
      <BiologyLine
        color={colors.genome}
        lineWidth={2.2}
        points={[
          [-0.18, 0.02, 0.18],
          [-0.04, 0.1, 0.18],
          [0.14, 0, 0.18],
        ]}
      />
      <BiologyLine
        color={colors.pathogen}
        lineWidth={2.4}
        points={[
          [-0.02, 0.08, 0.2],
          [0.06, 0.02, 0.2],
        ]}
      />
    </group>
  );
}
