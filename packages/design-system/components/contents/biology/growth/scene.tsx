import { useFrame } from "@react-three/fiber";
import type { PlantLifeCycle } from "@repo/design-system/components/contents/biology/growth/model";
import { evaluateGrowthCurve } from "@repo/design-system/components/contents/biology/growth/model";
import {
  GrowthPlantSpecimen,
  PLANTS,
  SOIL_LEVEL,
  SoilPlanterBed,
} from "@repo/design-system/components/contents/biology/growth/stages";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { HABITS } from "@repo/design-system/components/three/flora/habit";
import { Stake } from "@repo/design-system/components/three/flora/stake";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { useCallback, useRef } from "react";
import type { Group } from "three";

/** What the stake beside the plant reads from the soil up: 0 to 40 cm, a mark every centimetre and a numeral every 10. */
const STAKE_SCALE = { from: 0, major: 10, minor: 1, to: 40 } as const;

/** How long one centimetre of the stake is in the scene, so its 40 cm stand as tall as the grown plant. */
const CENTIMETRE = 1.35 / 40;

/** Where the stake is pushed into the soil, behind the plant and to its right, turned to face the reader. */
const STAKE = { turn: 0.43, x: 0.36, z: -0.18 } as const;

/**
 * What the camera fills the frame with at one point of the plant's growth:
 * the plant, and the stake up to the next 10 cm above the plant's tip, so a
 * seedling fills the frame as well as the grown plant and is read against
 * the marks that matter for it.
 */
function subjectAt(lifeCycle: PlantLifeCycle, dryMass: number) {
  const plant = PLANTS[lifeCycle];
  const habit = HABITS[plant.habit];
  const held = Math.min(1, Math.max(0.03, dryMass));
  const tall = (habit.height * plant.scale * held ** habit.bolt) / CENTIMETRE;
  const span = Math.min(40, Math.max(10, Math.ceil(tall / 10) * 10));
  const reach = span * CENTIMETRE;
  return {
    x: { max: STAKE.x + 0.1, min: -Math.max(0.32, Math.min(0.66, reach / 2)) },
    y: { max: SOIL_LEVEL + reach + 0.04, min: SOIL_LEVEL - 0.06 },
    z: { max: 0.05, min: -0.05 },
  };
}

function GrowthCamera() {
  return (
    <CameraControls
      cameraPosition={[1.25, 1.3, 2.7]}
      cameraTarget={[0.05, 0.78, 0]}
      fov={38}
      framing="content"
    />
  );
}

export function PlantSpecimenScene({
  lifeCycle,
  onTickTime,
  time,
}: {
  readonly lifeCycle: PlantLifeCycle;
  readonly onTickTime: (deltaTime: number) => void;
  readonly time: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const plantRef = useRef<Group>(null);
  const swayRef = useRef(0);
  const sample = evaluateGrowthCurve(lifeCycle, time);

  const rewind = useCallback(() => {
    swayRef.current = 0;
    if (plantRef.current !== null) {
      plantRef.current.rotation.z = 0;
    }
  }, []);
  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    const dt = simulationStep(delta);
    onTickTime(dt * 12);
    swayRef.current += dt * 1.8;
    if (plantRef.current !== null) {
      plantRef.current.rotation.z = Math.sin(swayRef.current) * 0.03;
    }
  });

  const isSenescent = sample.phase === "senescence";
  const hasFlower =
    (lifeCycle === "annual" && time > 64) ||
    (lifeCycle === "biennial" && time > 72);

  return (
    <group>
      <SimulationTicker running={playing} />
      <GrowthCamera />
      <CameraBounds exclude>
        <SoilPlanterBed />
        <group
          position={[STAKE.x, SOIL_LEVEL, STAKE.z]}
          rotation={[0, STAKE.turn, 0]}
        >
          <Stake
            depth={0.12}
            length={40 * CENTIMETRE}
            scale={STAKE_SCALE}
            width={0.11}
          />
        </group>
      </CameraBounds>
      <CameraBounds bounds={subjectAt(lifeCycle, sample.dryMass)}>
        <group ref={plantRef}>
          <GrowthPlantSpecimen
            dryMass={sample.dryMass}
            hasFlower={hasFlower}
            isSenescent={isSenescent}
            lifeCycle={lifeCycle}
          />
        </group>
      </CameraBounds>
    </group>
  );
}
