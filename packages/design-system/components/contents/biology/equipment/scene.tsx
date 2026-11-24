import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { Bench } from "@repo/design-system/components/contents/biology/equipment/bench";
import { EquipmentCamera } from "@repo/design-system/components/contents/biology/equipment/camera";
import { FumeChamber } from "@repo/design-system/components/contents/biology/equipment/chamber";
import { LabCoat } from "@repo/design-system/components/contents/biology/equipment/coat";
import {
  DissectingTile,
  Forceps,
  MountedNeedle,
  Scalpel,
} from "@repo/design-system/components/contents/biology/equipment/dissection";
import { Eyewash } from "@repo/design-system/components/contents/biology/equipment/eyewash";
import {
  reachOf,
  spotOf,
  topOf,
} from "@repo/design-system/components/contents/biology/equipment/framing";
import {
  Beaker,
  ConicalFlask,
  MeasuringCylinder,
  PetriDish,
} from "@repo/design-system/components/contents/biology/equipment/glass";
import {
  Microscope,
  Slides,
} from "@repo/design-system/components/contents/biology/equipment/microscope";
import {
  Pick,
  Picker,
  usePick,
} from "@repo/design-system/components/contents/biology/equipment/pick";
import { nextItem } from "@repo/design-system/components/contents/biology/equipment/places";
import { Room } from "@repo/design-system/components/contents/biology/equipment/room";
import {
  Extinguisher,
  FireBlanket,
  FirstAid,
} from "@repo/design-system/components/contents/biology/equipment/safety";
import {
  BunsenBurner,
  InoculatingLoop,
  Tripod,
} from "@repo/design-system/components/contents/biology/equipment/tools";
import {
  BoilingTube,
  Dropper,
  TestTube,
  TubeRack,
} from "@repo/design-system/components/contents/biology/equipment/tubes";
import {
  Gloves,
  Goggles,
  Mask,
} from "@repo/design-system/components/contents/biology/equipment/wear";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { useEffect, useMemo, useRef } from "react";
import { Object3D, SpotLight } from "three";

/** How long the tour rests on each item while the card plays, in seconds, the camera's move included. */
const TOUR_HOLD = 4.5;

/**
 * One corner of a school biology laboratory at real size: the bench with its
 * sink, eyewash and apparatus, the protective equipment on the side wall's
 * hooks and on the bench, the safety equipment on the side wall, and the fume
 * chamber. Every item the lesson lists can be picked; the camera then turns
 * to it, a soft spotlight finds it, and its name stands above it.
 */
export function EquipmentScene() {
  return (
    <group>
      <EquipmentCamera />
      <Picker />
      <Tour />
      <Room />
      <Bench />
      <TubeRack />
      <DissectingTile />
      <Pick item="beaker">
        <Beaker />
      </Pick>
      <Pick item="conicalFlask">
        <ConicalFlask />
      </Pick>
      <Pick item="measuringCylinder">
        <MeasuringCylinder />
      </Pick>
      <Pick item="testTube">
        <TestTube />
      </Pick>
      <Pick item="boilingTube">
        <BoilingTube />
      </Pick>
      <Pick item="dropper">
        <Dropper />
      </Pick>
      <Pick item="petriDish">
        <PetriDish />
      </Pick>
      <Pick item="inoculatingLoop">
        <InoculatingLoop />
      </Pick>
      <Pick item="bunsenBurner">
        <BunsenBurner />
      </Pick>
      <Pick item="tripod">
        <Tripod />
      </Pick>
      <Pick item="forceps">
        <Forceps />
      </Pick>
      <Pick item="scalpel">
        <Scalpel />
      </Pick>
      <Pick item="mountedNeedle">
        <MountedNeedle />
      </Pick>
      <Pick item="microscope">
        <Microscope />
      </Pick>
      <Pick item="slide">
        <Slides />
      </Pick>
      <Pick item="labCoat">
        <LabCoat />
      </Pick>
      <Pick item="goggles">
        <Goggles />
      </Pick>
      <Pick item="gloves">
        <Gloves />
      </Pick>
      <Pick item="mask">
        <Mask />
      </Pick>
      <Pick item="extinguisher">
        <Extinguisher />
      </Pick>
      <Pick item="fireBlanket">
        <FireBlanket />
      </Pick>
      <Pick item="eyewash">
        <Eyewash />
      </Pick>
      <Pick item="firstAid">
        <FirstAid />
      </Pick>
      <Pick item="fumeChamber">
        <FumeChamber />
      </Pick>
      <Spotlight />
      <NameLabel />
    </group>
  );
}

/**
 * The soft spotlight on the picked item, hung above it on the camera's side
 * with a cone just wide enough to hold it. It casts no shadow of its own, so
 * the room's key light keeps the shadows.
 */
function Spotlight() {
  const { current } = usePick();
  const spot = spotOf(current);
  const aim = useMemo(() => new Object3D(), []);
  const light = useMemo(() => {
    const lamp = new SpotLight(
      LABORATORY_COLORS.spot,
      spot.intensity,
      0,
      spot.angle,
      0.65,
      2
    );
    lamp.target = aim;
    return lamp;
  }, [aim, spot.angle, spot.intensity]);
  useEffect(() => () => light.dispose(), [light]);
  return (
    <>
      <primitive object={aim} position={spot.target} />
      <primitive object={light} position={spot.position} />
    </>
  );
}

/** The picked item's name, standing just above it in the ink that reads on the theme. */
function NameLabel() {
  const { current, name } = usePick();
  const ink = useLabelInk();
  if (name === undefined) {
    return null;
  }
  return (
    <ThreeLabel
      anchorY="bottom"
      color={ink}
      gap={0.12 * reachOf(current)}
      position={topOf(current)}
    >
      {name}
    </ThreeLabel>
  );
}

/**
 * While the card plays, picks the next item every few seconds, so the camera
 * tours the corner item by item in the lesson's order and the readouts follow.
 */
function Tour() {
  const { current, items, pick } = usePick();
  const playing = useVisualScene((card) => card.playing, false);
  const held = useRef(0);

  useFrame((_, delta) => {
    if (!playing) {
      held.current = 0;
      return;
    }
    held.current += simulationStep(delta);
    if (held.current >= TOUR_HOLD) {
      held.current = 0;
      pick(nextItem(items, current));
    }
  });

  return null;
}
