import { useFrame } from "@react-three/fiber";
import { PhysicsCarModel } from "@repo/design-system/components/contents/physics/kinematics/car";
import type {
  InstantaneousSpeedCaseId,
  InstantaneousVelocitySpeedState,
} from "@repo/design-system/components/contents/physics/kinematics/instantaneous-velocity-speed/data";
import {
  DEFAULT_INSTANTANEOUS_SPEED_CASE_ID,
  getInstantaneousVelocitySpeedState,
  INSTANTANEOUS_SPEED_CAMERA,
  INSTANTANEOUS_SPEED_CAR_MODEL_PATH,
  INSTANTANEOUS_SPEED_CASES,
  INSTANTANEOUS_SPEED_COLORS,
  INSTANTANEOUS_SPEED_SCENE,
  isInstantaneousSpeedCaseId,
} from "@repo/design-system/components/contents/physics/kinematics/instantaneous-velocity-speed/data";
import { lerp } from "@repo/design-system/components/contents/physics/kinematics/lerp";
import {
  formatRoundedSecondMath,
  formatRoundedSpeedMath,
  formatSignedRoundedSpeedMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Road } from "@repo/design-system/components/three/stage/road";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  useVisualScene,
  useVisualStop,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** The height of the road the car drives on. */
const ROAD_Y = 0.01;

interface InstantaneousVelocitySpeedLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    chooseMoment: string;
    factLabels: {
      speed: ReactNode;
      time: ReactNode;
      velocity: ReactNode;
    };
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

export function InstantaneousVelocitySpeedLab({
  title,
  description,
  labels,
}: InstantaneousVelocitySpeedLabProps) {
  const [caseId, setCaseId] = useState<InstantaneousSpeedCaseId>(
    DEFAULT_INSTANTANEOUS_SPEED_CASE_ID
  );
  const motion = useMemo(
    () => getInstantaneousVelocitySpeedState(caseId),
    [caseId]
  );
  const facts = [
    {
      id: "time",
      label: labels.factLabels.time,
      math: `t=${formatRoundedSecondMath(motion.scenario.time)}`,
    },
    {
      id: "speed",
      label: labels.factLabels.speed,
      math: formatRoundedSpeedMath(motion.scenario.speed),
    },
    {
      id: "velocity",
      label: labels.factLabels.velocity,
      math: formatSignedRoundedSpeedMath(motion.velocity),
    },
  ];

  function handleCaseChange(value: string) {
    if (isInstantaneousSpeedCaseId(value)) {
      setCaseId(value);
    }
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseMoment}
          gridColumns="2"
          onValueChange={handleCaseChange}
          type="single"
          value={caseId}
          variant="outline"
        >
          {Arr.map(INSTANTANEOUS_SPEED_CASES, (scenario) => (
            <ToggleGroupItem key={scenario.id} value={scenario.id}>
              <InlineMath
                math={`t=${formatRoundedSecondMath(scenario.time)}`}
              />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          floor={ROAD_Y}
          frameloop="always"
          ground="grass"
          setting="field"
        >
          <Suspense>
            <CameraControls
              cameraPosition={INSTANTANEOUS_SPEED_CAMERA.cameraPosition}
              cameraTarget={INSTANTANEOUS_SPEED_CAMERA.cameraTarget}
              enablePan
              enableRotate
              enableZoom
              fov={INSTANTANEOUS_SPEED_CAMERA.fov}
            />
            <InstantaneousVelocitySpeedScene motion={motion} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {Arr.map(facts, (fact) => (
            <VisualFactTabular
              key={fact.id}
              label={fact.label}
              value={<InlineMath math={fact.math} />}
            />
          ))}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

function InstantaneousVelocitySpeedScene({
  motion,
}: {
  motion: InstantaneousVelocitySpeedState;
}) {
  return (
    <group>
      <Road
        dash={INSTANTANEOUS_SPEED_SCENE.stripeLength}
        spacing={INSTANTANEOUS_SPEED_SCENE.stripeSpacing}
        width={INSTANTANEOUS_SPEED_SCENE.roadWidth}
      />
      <MeasurementPoint x={motion.measurementX} />
      <AnimatedCar motion={motion} />
    </group>
  );
}

function MeasurementPoint({ x }: { x: number }) {
  const sensorZ = INSTANTANEOUS_SPEED_SCENE.roadWidth * 0.62;
  const sensorSides = Array.from({ length: 2 }, (_, index) => index * 2 - 1);

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry
          args={[
            INSTANTANEOUS_SPEED_SCENE.detectorStripWidth,
            0.035,
            INSTANTANEOUS_SPEED_SCENE.roadWidth * 0.95,
          ]}
        />
        <meshStandardMaterial
          color={INSTANTANEOUS_SPEED_COLORS.detector}
          emissive={INSTANTANEOUS_SPEED_COLORS.detector}
          emissiveIntensity={0.18}
          roughness={0.48}
        />
      </mesh>

      {Arr.map(sensorSides, (side) => (
        <group key={side} position={[0, 0, side * sensorZ]}>
          <mesh castShadow position={[0, 0.1, 0]}>
            <cylinderGeometry
              args={[
                INSTANTANEOUS_SPEED_SCENE.detectorPostRadius,
                INSTANTANEOUS_SPEED_SCENE.detectorPostRadius,
                0.2,
                18,
              ]}
            />
            <meshStandardMaterial
              color={INSTANTANEOUS_SPEED_COLORS.detectorBase}
              roughness={0.62}
            />
          </mesh>
          <mesh
            castShadow
            position={[0, INSTANTANEOUS_SPEED_SCENE.detectorHeight, 0]}
          >
            <sphereGeometry
              args={[
                INSTANTANEOUS_SPEED_SCENE.detectorPostRadius * 1.7,
                18,
                12,
              ]}
            />
            <meshStandardMaterial
              color={INSTANTANEOUS_SPEED_COLORS.detector}
              emissive={INSTANTANEOUS_SPEED_COLORS.detector}
              emissiveIntensity={0.12}
              roughness={0.5}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function AnimatedCar({ motion }: { motion: InstantaneousVelocitySpeedState }) {
  const playing = useVisualScene((card) => card.playing, false);
  const groupRef = useRef<Group>(null);
  const elapsedRef = useRef(0);
  const scenarioIdRef = useRef<InstantaneousSpeedCaseId>(motion.scenario.id);

  useVisualStop(() => {
    elapsedRef.current = 0;
    groupRef.current?.position.set(
      motion.startX,
      0.025,
      INSTANTANEOUS_SPEED_SCENE.trackZ
    );
  });

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    if (scenarioIdRef.current !== motion.scenario.id) {
      elapsedRef.current = 0;
      scenarioIdRef.current = motion.scenario.id;
    }

    const totalLoop =
      motion.loopSeconds + INSTANTANEOUS_SPEED_SCENE.pauseSeconds;
    if (playing) {
      elapsedRef.current =
        (elapsedRef.current + simulationStep(delta)) % totalLoop;
    }
    const carX = getAnimatedCarX(motion, elapsedRef.current);

    groupRef.current.position.set(
      carX,
      0.025,
      INSTANTANEOUS_SPEED_SCENE.trackZ
    );
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <CameraBounds
        motion={{
          translation: {
            x: {
              min: Math.min(motion.startX, motion.endX),
              max: Math.max(motion.startX, motion.endX),
            },
            y: { min: 0.025, max: 0.025 },
            z: {
              min: INSTANTANEOUS_SPEED_SCENE.trackZ,
              max: INSTANTANEOUS_SPEED_SCENE.trackZ,
            },
          },
        }}
        objectRef={groupRef}
      >
        <group
          rotation={[0, getCarRotationY(motion.scenario.direction), 0]}
          scale={INSTANTANEOUS_SPEED_SCENE.carScale}
        >
          <PhysicsCarModel
            bodyColor={INSTANTANEOUS_SPEED_COLORS.car}
            modelPath={INSTANTANEOUS_SPEED_CAR_MODEL_PATH}
          />
        </group>
      </CameraBounds>
    </>
  );
}

function getAnimatedCarX(
  motion: InstantaneousVelocitySpeedState,
  elapsedSeconds: number
) {
  if (elapsedSeconds >= motion.loopSeconds) {
    return motion.endX;
  }

  const progress = elapsedSeconds / motion.loopSeconds;

  return lerp(motion.startX, motion.endX, progress);
}

function getCarRotationY(direction: number) {
  return direction > 0 ? Math.PI / 2 : -Math.PI / 2;
}
