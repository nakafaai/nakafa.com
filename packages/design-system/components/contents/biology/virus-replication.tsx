"use client";

import { BiologyCallouts } from "@repo/design-system/components/contents/biology/callouts";
import type {
  BiologyLabProps,
  BiologySceneColors,
  BiologySceneProps,
  BiologySceneView,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import { DnaDoubleHelix } from "@repo/design-system/components/contents/biology/parts";
import {
  BacteriophageModel,
  VirusTube,
} from "@repo/design-system/components/contents/biology/virus-parts";

const REPLICATION_SCENE_POSITION = [0, 0.06, 0] as const;
const REPLICATION_VIEW = {
  cameraPosition: [2.65, 1.5, 3.35],
  cameraTarget: [0, 0.05, 0],
  narrowCameraPosition: [3.05, 1.78, 3.75],
} satisfies BiologySceneView;
const REPLICATION_SCENE_SCALE = 1.08;
const LYTIC_LABEL_TARGETS = [
  {
    id: "host-cell",
    labelPosition: [-1.2, -0.3, 0.78],
    target: [-0.68, -0.12, 0.34],
  },
  {
    id: "viral-genome",
    labelPosition: [0.62, -0.46, 0.86],
    target: [0.08, -0.18, 0.16],
  },
] as const;
const LYSOGENIC_LABEL_TARGETS = [
  {
    id: "host-dna",
    labelPosition: [-0.82, -0.18, 0.86],
    target: [-0.38, -0.02, 0.2],
  },
  {
    id: "viral-genome",
    labelPosition: [0.8, -0.34, 0.86],
    target: [0.08, 0.02, 0.2],
  },
] as const;

type VirusReplicationMode = "both" | "lytic" | "lysogenic";

/**
 * Renders the viral replication lab with lytic and lysogenic cycle views.
 */
export function VirusReplicationLab({
  mode = "both",
  ...props
}: BiologyLabProps & { mode?: VirusReplicationMode }) {
  const Scene = getVirusReplicationScene(mode);

  return <BiologyLabFrame scene={Scene} view={REPLICATION_VIEW} {...props} />;
}

function getVirusReplicationScene(mode: VirusReplicationMode) {
  if (mode === "lytic") {
    return LyticReplicationScene;
  }

  if (mode === "lysogenic") {
    return LysogenicReplicationScene;
  }

  return VirusReplicationScene;
}

function LyticReplicationScene({ colors, item }: BiologySceneProps) {
  return (
    <group
      position={REPLICATION_SCENE_POSITION}
      scale={REPLICATION_SCENE_SCALE}
    >
      <LyticCycle colors={colors} />
      <BiologyCallouts
        callouts={item.callouts}
        color={colors.text}
        targets={LYTIC_LABEL_TARGETS}
      />
    </group>
  );
}

function LysogenicReplicationScene({ colors, item }: BiologySceneProps) {
  return (
    <group
      position={REPLICATION_SCENE_POSITION}
      scale={REPLICATION_SCENE_SCALE}
    >
      <LysogenicCycle colors={colors} />
      <BiologyCallouts
        callouts={item.callouts}
        color={colors.text}
        targets={LYSOGENIC_LABEL_TARGETS}
      />
    </group>
  );
}

/**
 * Switches between immediate virion production and genome dormancy.
 */
function VirusReplicationScene(props: BiologySceneProps) {
  const { selectedIndex } = props;

  if (selectedIndex === 1) {
    return <LysogenicReplicationScene {...props} />;
  }

  return <LyticReplicationScene {...props} />;
}

/**
 * Shows the full lytic cycle at once so students do not need five separate tabs.
 */
function LyticCycle({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <HostCell
        color={colors.host}
        radius={0.54}
        scale={[0.92, 1.42, 0.72]}
        straightLength={1.16}
      />

      <group position={[-0.18, 0.92, 0.24]} rotation={[0.12, 0.08, -0.08]}>
        <BacteriophageModel colors={colors} scale={0.9} />
      </group>

      <VirusTube
        color={colors.pathogen}
        points={[
          [-0.18, 0.38, 0.24],
          [-0.12, 0.16, 0.2],
          [-0.02, -0.08, 0.12],
        ]}
        radius={0.018}
      />

      <group position={[0.1, -0.18, 0.1]} rotation={[0.2, 0.3, -0.72]}>
        <DnaDoubleHelix
          backboneColor={colors.genome}
          length={0.72}
          lineWidth={3.2}
          pairColor={colors.muted}
          pairLineWidth={1}
          radius={0.046}
          turns={1.7}
        />
      </group>

      <NewVirionPreview colors={colors} position={[0.78, -0.12, 0.18]} />
      <NewVirionPreview colors={colors} position={[1.1, 0.18, -0.16]} />
    </group>
  );
}

/**
 * Shows a viral genome carried quietly with the host genome before activation.
 */
function LysogenicCycle({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <HostCell
        color={colors.host}
        radius={0.58}
        scale={[0.9, 1.45, 0.82]}
        straightLength={1.28}
      />

      <group position={[0, 0.04, 0.18]} rotation={[0.1, 0.28, 0.36]}>
        <DnaDoubleHelix
          backboneColor={colors.genome}
          length={1.46}
          lineWidth={3.8}
          pairColor={colors.muted}
          pairLineWidth={1.1}
          radius={0.066}
          turns={2.8}
        />
        <DnaDoubleHelix
          backboneColor={colors.pathogen}
          length={1.46}
          lineWidth={4.8}
          pairColor={colors.pathogen}
          pairLineWidth={1.5}
          radius={0.07}
          segment={[0.46, 0.62]}
          turns={2.8}
        />
      </group>
    </group>
  );
}

/**
 * Shows the bacterial host as a transparent cell with a subtle membrane edge.
 */
function HostCell({
  color,
  radius,
  scale,
  straightLength,
}: {
  color: string;
  radius: number;
  scale: readonly [number, number, number];
  straightLength: number;
}) {
  return (
    <group rotation={[0, 0, Math.PI / 2]} scale={scale}>
      <mesh>
        <capsuleGeometry args={[radius, straightLength, 14, 34]} />
        <meshStandardMaterial color={color} opacity={0.2} transparent />
      </mesh>
      <mesh scale={1.02}>
        <capsuleGeometry args={[radius, straightLength, 14, 34]} />
        <meshStandardMaterial color={color} opacity={0.08} transparent />
      </mesh>
    </group>
  );
}

/**
 * Shows newly assembled phage particles inside the host as a secondary cue.
 */
function NewVirionPreview({
  colors,
  position,
}: {
  colors: BiologySceneColors;
  position: readonly [number, number, number];
}) {
  return (
    <group position={position} scale={0.34}>
      <BacteriophageModel colors={colors} />
    </group>
  );
}
