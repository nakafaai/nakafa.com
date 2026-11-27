import { useFrame } from "@react-three/fiber";
import { GraduatedRuler } from "@repo/design-system/components/contents/biology/fixtures";
import type { PlantLifeCycle } from "@repo/design-system/components/contents/biology/growth/model";
import { evaluateGrowthCurve } from "@repo/design-system/components/contents/biology/growth/model";
import {
  GrowthPlantSpecimen,
  SoilPlanterBed,
} from "@repo/design-system/components/contents/biology/growth/stages";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { useCallback, useRef } from "react";
import type { Group } from "three";

/** What the ruler beside the planter reads along its length: 0 to 40 cm, numbered every 5. */
const RULER_SCALE = { from: 0, major: 5, minor: 1, to: 40 } as const;

/** What the camera fills the frame with: the seed pan and the ruler the plant is read against. */
const SUBJECT = {
  x: { max: 0.82, min: -0.65 },
  y: { max: 1.5, min: -0.14 },
  z: { max: 0.05, min: -0.05 },
} as const;

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
      <CameraBounds bounds={SUBJECT}>
        <SoilPlanterBed />

        {/* Botanical wooden scale ruler standing beside the planter */}
        <GraduatedRuler
          height={1.35}
          position={[0.76, 0.68, -0.06]}
          rotation={[0, -0.25, 0]}
          scale={RULER_SCALE}
          turn={0}
          width={0.09}
        />

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
