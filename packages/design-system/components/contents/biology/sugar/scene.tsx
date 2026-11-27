import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  chainLayout,
  GAP,
  MIDDLE,
  pairLayout,
  stageOf,
} from "@repo/design-system/components/contents/biology/sugar/layout";
import type {
  Monomer,
  Polysaccharide,
  Reaction,
  Sugar,
} from "@repo/design-system/components/contents/biology/sugar/polymer";
import { monomersOf } from "@repo/design-system/components/contents/biology/sugar/polymer";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MoleculeModel } from "@repo/design-system/components/three/molecule/kit";
import { smallOf } from "@repo/design-system/components/three/molecule/small";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr } from "effect";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** The one water molecule a glycosidic bond gives up or takes. */
const WATER = smallOf("water");

/** How fast a reaction plays, in radians of its cycle a second, and how fast a chain breathes. */
const PACE = 1.4;
const BREATH = 2.6;

/** The camera of both scenes: it frames the atoms and their labels, whatever the shape of the frame. */
function SugarCamera() {
  return (
    <CameraControls
      cameraPosition={[0, 0.9, 2.18]}
      cameraTarget={[0, MIDDLE, 0]}
      fov={38}
      framing="content"
    />
  );
}

/**
 * Two sugars and the glycosidic bond between them, as ball and stick models
 * with every atom: glucose and galactose as chairs, fructose as its
 * five-membered ring. Condensation brings the two free sugars together,
 * joins carbon to carbon through one oxygen and lets one water molecule
 * drift away; hydrolysis plays it back, the water going in and the sugars
 * coming apart whole. At rest the scene shows what the reaction ends with.
 */
export function PairScene({
  bondLabel,
  monomerNames,
  reaction,
  sugar,
}: {
  readonly bondLabel: string;
  readonly monomerNames: Readonly<Record<Monomer, string>>;
  readonly reaction: Reaction;
  readonly sugar: Sugar;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const ink = useLabelInk();
  const layout = useMemo(() => pairLayout(sugar), [sugar]);
  const [firstName, secondName] = monomersOf(sugar);
  const joined = useRef<Group>(null);
  const first = useRef<Group>(null);
  const second = useRef<Group>(null);
  const water = useRef<Group>(null);
  const firstMark = useRef<Group>(null);
  const secondMark = useRef<Group>(null);
  const clock = useRef(0);
  const end = reaction === "condensation" ? 1 : 0;
  const [bonded, setBonded] = useState(end === 1);

  const show = (phase: number) => {
    const stage = stageOf(phase);
    const shift = (stage.apart * GAP) / 2;
    joined.current?.position.set(0, 0, 0);
    first.current?.position.set(-shift, 0, 0);
    second.current?.position.set(shift, 0, 0);
    firstMark.current?.position.set(-shift * layout.size, 0, 0);
    secondMark.current?.position.set(shift * layout.size, 0, 0);
    water.current?.position.set(
      layout.bridge[0] + (layout.rest[0] - layout.bridge[0]) * stage.drift,
      layout.bridge[1] + (layout.rest[1] - layout.bridge[1]) * stage.drift,
      layout.bridge[2] + (layout.rest[2] - layout.bridge[2]) * stage.drift
    );
    setBonded(stage.bonded);
    Arr.forEach([joined, water], (part) => {
      if (part.current !== null) {
        part.current.visible = stage.bonded;
      }
    });
    Arr.forEach([first, second], (part) => {
      if (part.current !== null) {
        part.current.visible = !stage.bonded;
      }
    });
    invalidate();
  };

  useLayoutEffect(() => {
    clock.current = 0;
    show(end);
  });

  useVisualStop(() => {
    clock.current = 0;
    show(end);
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current += simulationStep(delta);
    const wave = (1 - Math.cos(clock.current * PACE)) / 2;
    show(reaction === "condensation" ? wave : 1 - wave);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <SugarCamera />
      <group position={layout.stand} scale={layout.size}>
        <CameraBounds bounds={layout.bounds}>
          <group ref={joined}>
            <MoleculeModel molecule={layout.molecule} style="sticks" />
          </group>
          <group ref={first}>
            <MoleculeModel molecule={layout.first} style="sticks" />
          </group>
          <group ref={second}>
            <MoleculeModel molecule={layout.second} style="sticks" />
          </group>
          <group ref={water} rotation={[0.5, 0.4, 2.2]}>
            <MoleculeModel molecule={WATER} style="sticks" />
          </group>
        </CameraBounds>
      </group>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={layout.marks.bond}
        visible={bonded}
      >
        {bondLabel}
      </ThreeLabel>
      <group ref={firstMark}>
        <ThreeLabel
          anchorY="top"
          color={ink}
          fontSize="compact"
          position={layout.marks.first}
        >
          {monomerNames[firstName]}
        </ThreeLabel>
      </group>
      <group ref={secondMark}>
        <ThreeLabel
          anchorY="top"
          color={ink}
          fontSize="compact"
          position={layout.marks.second}
        >
          {monomerNames[secondName]}
        </ThreeLabel>
      </group>
    </group>
  );
}

/**
 * A polysaccharide of glucose units as a ball and stick model with every
 * atom: starch winding into its helix, glycogen a helix that branches at
 * carbon 6, and cellulose a straight ribbon beside the neighbouring chain
 * of its sheet, which is drawn pale, with the hydrogen bonds between the two
 * as beads. While the card plays, the chain breathes.
 */
export function ChainScene({
  bondLabel,
  polysaccharide,
  units,
}: {
  readonly bondLabel: string;
  readonly polysaccharide: Polysaccharide;
  readonly units: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const root = useRef<Group>(null);
  const clock = useRef(0);
  const layout = useMemo(
    () => chainLayout(polysaccharide, units),
    [polysaccharide, units]
  );
  const tints = useMemo(
    () =>
      Number.isFinite(layout.beside)
        ? Arr.makeBy(layout.beside * 2, (part) =>
            part < layout.beside ? undefined : BIOLOGY_COLORS.chainBeside
          )
        : [],
    [layout.beside]
  );

  useFrame((_, delta) => {
    if (!playing || root.current === null) {
      return;
    }
    clock.current += simulationStep(delta);
    root.current.position.y = Math.sin(clock.current * BREATH) * 0.006;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <SugarCamera />
      <group ref={root}>
        <group position={layout.stand} scale={layout.size}>
          <CameraBounds bounds={layout.bounds}>
            <MoleculeModel
              molecule={layout.molecule}
              style="sticks"
              tints={tints}
            />
          </CameraBounds>
        </group>
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          fontSize="compact"
          position={layout.mark}
        >
          {bondLabel}
        </ThreeLabel>
      </group>
    </group>
  );
}
