"use client";

import type {
  BiologyLabItem,
  BiologyLabProps,
  BiologySceneColors,
  BiologySceneProps,
  BiologySceneView,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyLine,
  DnaDoubleHelix,
  PulsingGroup,
  RotatingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import { BacteriophageModel } from "@repo/design-system/components/contents/biology/virus-parts";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";

const VIRUS_STAGES = [
  { id: "attach", position: [-1.26, 0.42, 0.36] },
  { id: "enter", position: [-0.62, 0.18, 0.38] },
  { id: "assemble", position: [0.58, 0.06, 0.4] },
  { id: "release", position: [1.52, 0.32, 0.42] },
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
const LYTIC_CALLOUTS = [
  {
    id: "genome-entry",
    labelPosition: [-1, 0.94, 0.72],
    leaderPoints: [
      [-0.86, 0.62, 0.64],
      [-0.58, 0.22, 0.52],
    ],
  },
  {
    id: "viral-parts",
    labelPosition: [0.12, 0.76, 0.76],
    leaderPoints: [
      [0.1, 0.44, 0.66],
      [0.08, 0.2, 0.5],
    ],
  },
  {
    id: "new-virion",
    labelPosition: [1.26, 0.94, 0.72],
    leaderPoints: [
      [1.24, 0.62, 0.64],
      [1.45, 0.36, 0.46],
    ],
  },
] as const;
const DAUGHTER_CELLS = [
  { id: "left", position: [-0.72, -0.42, 0.24] },
  { id: "right", position: [0.72, -0.42, 0.24] },
] as const;
const LYSOGENIC_CALLOUTS = [
  {
    id: "host-dna",
    labelPosition: [-0.72, 0.74, 0.72],
    leaderPoints: [
      [-0.58, 0.46, 0.64],
      [-0.42, 0.24, 0.44],
    ],
  },
  {
    id: "viral-genome",
    labelPosition: [0.12, 0.72, 0.74],
    leaderPoints: [
      [0.1, 0.42, 0.64],
      [0.06, 0.04, 0.46],
    ],
  },
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
function VirusReplicationScene({
  colors,
  item,
  selectedIndex,
}: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <LysogenicCycle colors={colors} item={item} />;
  }

  return <LyticCycle colors={colors} item={item} />;
}

/**
 * Shows the full lytic cycle at once so students do not need five separate tabs.
 */
function LyticCycle({
  colors,
  item,
}: Pick<BiologySceneProps, "colors" | "item">) {
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
        <group position={[-0.54, 0.16, 0.5]} rotation={[0.08, 0.1, -0.48]}>
          <DnaDoubleHelix
            backboneColor={colors.genome}
            length={0.58}
            lineWidth={3}
            pairColor={colors.muted}
            radius={0.034}
            turns={1.25}
          />
        </group>
      </PulsingGroup>

      <PulsingGroup speed={1.7} strength={0.05}>
        {VIRAL_PARTS.map((part) => (
          <ViralPart colors={colors} key={part.id} part={part} />
        ))}
      </PulsingGroup>

      {LYTIC_CALLOUTS.map((callout) => (
        <ReplicationCallout
          callout={callout}
          colors={colors}
          item={item}
          key={callout.id}
        />
      ))}
    </group>
  );
}

/**
 * Shows a viral genome carried quietly with the host genome before activation.
 */
function LysogenicCycle({
  colors,
  item,
}: Pick<BiologySceneProps, "colors" | "item">) {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} scale={[0.8, 1.3, 0.8]}>
        <capsuleGeometry args={[0.48, 1.36, 12, 30]} />
        <meshStandardMaterial color={colors.host} opacity={0.24} transparent />
      </mesh>

      <PulsingGroup speed={1.3} strength={0.04}>
        <group position={[0, 0.14, 0.42]} rotation={[0.06, 0, 0.28]}>
          <DnaDoubleHelix
            backboneColor={colors.genome}
            length={1.38}
            lineWidth={3.2}
            pairColor={colors.muted}
            radius={0.055}
            turns={2.6}
          />
          <DnaDoubleHelix
            backboneColor={colors.pathogen}
            length={1.38}
            lineWidth={4.2}
            pairColor={colors.pathogen}
            pairLineWidth={1.4}
            radius={0.058}
            segment={[0.46, 0.62]}
            turns={2.6}
          />
        </group>
      </PulsingGroup>

      {DAUGHTER_CELLS.map((cell) => (
        <DaughterCell colors={colors} key={cell.id} position={cell.position} />
      ))}

      {LYSOGENIC_CALLOUTS.map((callout) => (
        <ReplicationCallout
          callout={callout}
          colors={colors}
          item={item}
          key={callout.id}
        />
      ))}
    </group>
  );
}

/**
 * Adds one localized leader label without turning the scene into a text panel.
 */
function ReplicationCallout({
  callout,
  colors,
  item,
}: {
  callout:
    | (typeof LYTIC_CALLOUTS)[number]
    | (typeof LYSOGENIC_CALLOUTS)[number];
  colors: BiologySceneColors;
  item: BiologyLabItem;
}) {
  const label = item.callouts?.find(({ id }) => id === callout.id)?.label;

  if (!label) {
    return null;
  }

  return (
    <group>
      <BiologyLine
        color={colors.text}
        lineWidth={1.6}
        points={callout.leaderPoints}
      />
      <SceneLabel
        alwaysOnTop
        color={colors.text}
        fontSize="marker"
        position={callout.labelPosition}
      >
        {label}
      </SceneLabel>
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
      <DnaDoubleHelix
        backboneColor={colors.genome}
        length={0.3}
        lineWidth={2.4}
        pairColor={colors.muted}
        pairLineWidth={0.8}
        radius={0.03}
        turns={0.9}
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
      <group position={[0, 0.02, 0.22]} rotation={[0, 0, 0.26]} scale={0.36}>
        <DnaDoubleHelix
          backboneColor={colors.genome}
          length={0.84}
          lineWidth={2.2}
          pairColor={colors.muted}
          pairLineWidth={0.8}
          radius={0.045}
          turns={1.1}
        />
        <DnaDoubleHelix
          backboneColor={colors.pathogen}
          length={0.84}
          lineWidth={2.8}
          pairColor={colors.pathogen}
          pairLineWidth={0.9}
          radius={0.048}
          segment={[0.44, 0.62]}
          turns={1.1}
        />
      </group>
    </group>
  );
}
