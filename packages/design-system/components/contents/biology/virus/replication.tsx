import {
  OpenBacillus,
  Ribosomes,
} from "@repo/design-system/components/contents/biology/bacteria/parts";
import { BiologyCallouts } from "@repo/design-system/components/contents/biology/callouts";
import { useBiologyItemSelection } from "@repo/design-system/components/contents/biology/context";
import type {
  BiologyLabProps,
  BiologySceneProps,
} from "@repo/design-system/components/contents/biology/lab";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab";
import { DnaDoubleHelix } from "@repo/design-system/components/contents/biology/parts";
import { BacteriophageModel } from "@repo/design-system/components/contents/biology/virus/phage";
import type { NarrowCameraPose } from "@repo/design-system/lib/geometry/camera";
import { VIRION_COLORS } from "@repo/design-system/lib/material/virion";
import { Array as Arr } from "effect";
import type { ComponentType } from "react";
import { CatmullRomCurve3, Vector3 } from "three";

const REPLICATION_SCENE_POSITION = [0, 0.06, 0] as const;
const REPLICATION_VIEW = {
  cameraPosition: [2.65, 1.5, 3.35],
  cameraTarget: [0, 0.05, 0],
  narrowCameraPosition: [3.05, 1.78, 3.75],
} satisfies NarrowCameraPose;
const REPLICATION_SCENE_SCALE = 1.08;
const LYTIC_LABEL_TARGETS = [
  {
    id: "host-cell",
    labelPosition: [-1.2, -0.3, 0.78],
    target: [-1, -0.3, -0.36],
  },
  {
    id: "viral-genome",
    labelPosition: [0.62, -0.46, 0.86],
    target: [0.08, 0.04, -0.12],
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

/** The scene that each mode of the lab shows. */
const VIRUS_REPLICATION_SCENES = {
  both: VirusReplicationScene,
  lysogenic: LysogenicReplicationScene,
  lytic: LyticReplicationScene,
} satisfies Record<VirusReplicationMode, ComponentType<BiologySceneProps>>;

/**
 * Renders the viral replication lab with lytic and lysogenic cycle views.
 */
export function VirusReplicationLab({
  mode = "both",
  ...props
}: BiologyLabProps & { mode?: VirusReplicationMode }) {
  const Scene = VIRUS_REPLICATION_SCENES[mode];

  return <BiologyLabFrame scene={Scene} view={REPLICATION_VIEW} {...props} />;
}

function LyticReplicationScene({ item }: BiologySceneProps) {
  return (
    <group
      position={REPLICATION_SCENE_POSITION}
      scale={REPLICATION_SCENE_SCALE}
    >
      <LyticCycle />
      <BiologyCallouts callouts={item.callouts} targets={LYTIC_LABEL_TARGETS} />
    </group>
  );
}

function LysogenicReplicationScene({ item }: BiologySceneProps) {
  return (
    <group
      position={REPLICATION_SCENE_POSITION}
      scale={REPLICATION_SCENE_SCALE}
    >
      <LysogenicCycle />
      <BiologyCallouts
        callouts={item.callouts}
        targets={LYSOGENIC_LABEL_TARGETS}
      />
    </group>
  );
}

/**
 * Switches between immediate virion production and genome dormancy.
 */
function VirusReplicationScene({ item }: BiologySceneProps) {
  const selectedIndex = useBiologyItemSelection((state) => state.selectedIndex);
  const isLysogenic = selectedIndex === 1;

  return (
    <group
      key={selectedIndex}
      position={REPLICATION_SCENE_POSITION}
      scale={REPLICATION_SCENE_SCALE}
    >
      {isLysogenic ? <LysogenicCycle /> : <LyticCycle />}
      <BiologyCallouts
        callouts={item.callouts}
        targets={isLysogenic ? LYSOGENIC_LABEL_TARGETS : LYTIC_LABEL_TARGETS}
      />
    </group>
  );
}

/** The host bacterium, opened, at twice the bacteria labs' scale: about 3.2 long and 1.2 wide. */
const HOST_SCALE = 2;

/** The phage's DNA on its way from the tail tube into the cytoplasm, coiling as it goes. */
const INJECTED = new CatmullRomCurve3(
  Arr.map(
    [
      [-0.3, 0.52, 0],
      [-0.28, 0.36, -0.04],
      [-0.18, 0.22, -0.1],
      [-0.02, 0.18, -0.16],
      [0.08, 0.04, -0.12],
      [-0.06, -0.08, -0.18],
      [-0.2, -0.02, -0.22],
      [-0.12, 0.12, -0.26],
      [0.04, 0.02, -0.28],
    ] as const,
    (point) => new Vector3(...point)
  )
);

/** New phages assembling in the back of the cell, in the host's own frame. */
const PROGENY = [
  { id: "first", position: [0.32, -0.02, -0.12], rotation: [0.2, 0.4, -0.5] },
  { id: "second", position: [0.55, 0.06, -0.1], rotation: [-0.3, 1.2, 0.7] },
  { id: "third", position: [0.12, -0.1, -0.16], rotation: [0.1, 2.2, 1.6] },
] as const;

/**
 * Shows the lytic cycle in one scene: a phage landed on the host, its sheath
 * contracted and its DNA injected into the cytoplasm, while new phages
 * assemble in the back of the cell before it bursts.
 */
function LyticCycle() {
  return (
    <group>
      <group scale={HOST_SCALE}>
        <OpenBacillus>
          <Ribosomes />
          {Arr.map(PROGENY, ({ id, position, rotation }) => (
            <group key={id} position={position} rotation={rotation}>
              <BacteriophageModel scale={0.24} />
            </group>
          ))}
        </OpenBacillus>
      </group>
      <group position={[-0.3, 0.9, 0]}>
        <BacteriophageModel landed scale={0.9} />
      </group>
      <mesh castShadow>
        <tubeGeometry args={[INJECTED, 160, 0.012, 6, false]} />
        <meshStandardMaterial
          color={VIRION_COLORS.phageGenome}
          roughness={0.45}
        />
      </mesh>
    </group>
  );
}

/**
 * Shows the lysogenic cycle: the phage's genome sits as a prophage inside the
 * host's chromosome, copied with it at every division until it is induced.
 */
function LysogenicCycle() {
  return (
    <group>
      <group scale={HOST_SCALE}>
        <OpenBacillus>
          <Ribosomes />
        </OpenBacillus>
      </group>
      <group position={[0, 0.04, 0.18]} rotation={[0.1, 0.28, 0.36]}>
        <DnaDoubleHelix
          backboneColor={VIRION_COLORS.nucleicAcid}
          length={1.46}
          lineWidth={3.8}
          pairColor={VIRION_COLORS.nucleicAcid}
          pairLineWidth={1.1}
          radius={0.066}
          turns={2.8}
        />
        <DnaDoubleHelix
          backboneColor={VIRION_COLORS.phageGenome}
          length={1.46}
          lineWidth={4.8}
          pairColor={VIRION_COLORS.phageGenome}
          pairLineWidth={1.5}
          radius={0.07}
          segment={[0.46, 0.62]}
          turns={2.8}
        />
      </group>
    </group>
  );
}
