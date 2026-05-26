"use client";

import {
  BiologyCallouts,
  type BiologyCalloutTarget,
} from "@repo/design-system/components/contents/biology/callouts";
import type {
  BiologyLabProps,
  BiologySceneColors,
  BiologySceneProps,
  BiologySceneView,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import { DnaDoubleHelix } from "@repo/design-system/components/contents/biology/parts";
import { BacteriophageModel } from "@repo/design-system/components/contents/biology/virus-parts";

const LYTIC_PHAGES = [
  { id: "attach", position: [-1.26, 0.42, 0.36], scale: 0.52 },
  { id: "entry", position: [-0.62, 0.18, 0.38], scale: 0.52 },
  { id: "assembly", position: [0.58, 0.06, 0.4], scale: 0.44 },
  { id: "release", position: [1.42, 0.32, 0.42], scale: 0.44 },
] as const;

const VIRAL_PARTS = [
  {
    id: "capsid-a",
    kind: "capsid",
    position: [-0.18, 0.22, 0.5],
    scale: 0.9,
  },
  {
    id: "capsid-b",
    kind: "capsid",
    position: [0.02, 0.28, 0.52],
    scale: 0.78,
  },
  {
    id: "capsid-c",
    kind: "capsid",
    position: [0.2, 0.18, 0.5],
    scale: 0.7,
  },
  {
    id: "genome-a",
    kind: "genome",
    position: [-0.02, 0.02, 0.5],
    scale: 0.9,
  },
  {
    id: "genome-b",
    kind: "genome",
    position: [0.2, -0.02, 0.5],
    scale: 0.72,
  },
] as const;
const DAUGHTER_CELLS = [
  { id: "left", position: [-1.18, -0.08, 0.64] },
  { id: "right", position: [1.18, -0.08, 0.64] },
] as const;
const LYTIC_CALLOUT_TARGETS = [
  {
    id: "genome-entry",
    labelPosition: [-1.02, 0.98, 0.94],
    target: [-0.5, 0.18, 0.66],
  },
  {
    id: "new-virion",
    labelPosition: [0.78, 0.98, 0.82],
    target: [1.42, 0.44, 0.48],
  },
] satisfies readonly BiologyCalloutTarget[];
const LYSOGENIC_CALLOUT_TARGETS = [
  {
    id: "host-dna",
    labelPosition: [-0.62, 0.94, 0.82],
    target: [-0.64, 0.04, 0.5],
  },
  {
    id: "viral-genome",
    labelPosition: [0.48, 0.94, 0.82],
    target: [0.08, 0.15, 0.54],
  },
  {
    id: "daughter-cells",
    labelPosition: [1.14, 0.38, 1.04],
  },
] satisfies readonly BiologyCalloutTarget[];
const REPLICATION_SCENE_POSITION = [0, 0.18, 0] as const;
const REPLICATION_VIEW = {
  cameraPosition: [0, 1.56, 3.02],
  cameraTarget: [0, -0.06, 0.18],
  maxAzimuthAngle: Math.PI * 0.12,
  maxPolarAngle: Math.PI * 0.39,
  minAzimuthAngle: Math.PI * -0.12,
  minPolarAngle: Math.PI * 0.31,
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
    return (
      <group position={REPLICATION_SCENE_POSITION}>
        <LysogenicCycle colors={colors} item={item} />
      </group>
    );
  }

  return (
    <group position={REPLICATION_SCENE_POSITION}>
      <LyticCycle colors={colors} item={item} />
    </group>
  );
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

      {LYTIC_PHAGES.map((stage) => (
        <group key={stage.id} position={stage.position}>
          <BacteriophageModel colors={colors} scale={stage.scale} />
        </group>
      ))}

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

      {VIRAL_PARTS.map((part) => (
        <group key={part.id} position={part.position}>
          <ViralPart colors={colors} part={part} />
        </group>
      ))}

      <BiologyCallouts
        callouts={item.callouts}
        color={colors.text}
        targets={LYTIC_CALLOUT_TARGETS}
      />
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

      {DAUGHTER_CELLS.map((cell) => (
        <group key={cell.id} position={cell.position}>
          <DaughterCell colors={colors} />
        </group>
      ))}

      <BiologyCallouts
        callouts={item.callouts}
        color={colors.text}
        targets={LYSOGENIC_CALLOUT_TARGETS}
      />
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
      <mesh scale={part.scale}>
        <icosahedronGeometry args={[0.08, 1]} />
        <meshStandardMaterial color={colors.pathogen} roughness={0.72} />
      </mesh>
    );
  }

  return (
    <group scale={part.scale}>
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
function DaughterCell({ colors }: { colors: BiologySceneColors }) {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} scale={[0.34, 0.56, 0.34]}>
        <capsuleGeometry args={[0.3, 0.62, 8, 18]} />
        <meshStandardMaterial
          color={colors.microbe}
          opacity={0.78}
          transparent
        />
      </mesh>
      <group position={[0, 0.02, 0.32]} rotation={[0, 0, 0.26]} scale={0.4}>
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
