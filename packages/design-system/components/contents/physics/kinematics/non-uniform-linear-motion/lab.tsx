import { useFrame, useThree } from "@react-three/fiber";
import {
  formatAccelerationMath,
  formatTrimmedMeterMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";
import type {
  GlbbMotionState,
  GlbbScenarioId,
} from "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/data";
import {
  DEFAULT_GLBB_SCENARIO_ID,
  formatVelocityMath,
  GLBB_COLORS,
  GLBB_SCENARIOS,
  GLBB_SCENE,
  getGlbbLoopTime,
  getGlbbMotionState,
  getGlbbPositionSample,
  isGlbbScenarioId,
} from "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/data";
import {
  RAILCAR,
  Railcar,
} from "@repo/design-system/components/contents/physics/kinematics/train";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Rail } from "@repo/design-system/components/three/stage/rail";
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
import { VisualFactIndicator } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** The height of the bed the rails lie on. */
const BED_Y = -0.025;

interface GlbbLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    chooseScenario: string;
    factLabels: {
      acceleration: ReactNode;
      displacement: ReactNode;
      finalVelocity: ReactNode;
      initialVelocity: ReactNode;
    };
    scenarioNames: Record<GlbbScenarioId, ReactNode>;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

/**
 * Frames the run of track the railcar covers. A narrow frame is as wide as it
 * is tall, so its camera stands further back to keep the railcar's start in.
 */
function RailCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={
        narrow ? GLBB_SCENE.narrowCameraPosition : GLBB_SCENE.cameraPosition
      }
      cameraTarget={GLBB_SCENE.cameraTarget}
      enablePan
      enableRotate
      enableZoom
      fov={GLBB_SCENE.cameraFov}
    />
  );
}

export function NonUniformLinearMotionLab({
  title,
  description,
  labels,
}: GlbbLabProps) {
  const [scenarioId, setScenarioId] = useState<GlbbScenarioId>(
    DEFAULT_GLBB_SCENARIO_ID
  );
  const motion = useMemo(() => getGlbbMotionState(scenarioId), [scenarioId]);
  const reach = Math.abs(motion.trainStartX) + GLBB_SCENE.railGap * 2;

  function handleScenarioChange(value: string) {
    if (!isGlbbScenarioId(value)) {
      return;
    }

    setScenarioId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseScenario}
          gridColumns="3"
          onValueChange={handleScenarioChange}
          type="single"
          value={scenarioId}
          variant="outline"
        >
          {Arr.map(GLBB_SCENARIOS, (scenario) => (
            <ToggleGroupItem key={scenario.id} value={scenario.id}>
              {labels.scenarioNames[scenario.id]}
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
          floor={BED_Y}
          frameloop="always"
          ground="grass"
          reach={reach}
          setting="field"
        >
          <Suspense>
            <RailCamera />
            <Rail
              gauge={GLBB_SCENE.railGap}
              sleeper={GLBB_SCENE.sleeperWidth}
              spacing={GLBB_SCENE.sleeperSpacing}
            />
            <PositionMarkers motion={motion} />
            <AnimatedTrain motion={motion} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            label={labels.factLabels.initialVelocity}
            value={
              <InlineMath
                math={`v_0=${formatVelocityMath(
                  motion.scenario.initialVelocity
                )}`}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={motion.scenario.color}
            label={labels.factLabels.acceleration}
            value={
              <InlineMath
                math={`a=${formatAccelerationMath(
                  motion.scenario.acceleration
                )}`}
              />
            }
          />
          <VisualFactIndicator
            label={labels.factLabels.finalVelocity}
            value={
              <InlineMath
                math={`v_t=${formatVelocityMath(motion.finalVelocity)}`}
              />
            }
          />
          <VisualFactIndicator
            label={labels.factLabels.displacement}
            value={
              <InlineMath
                math={`\\Delta x=${formatTrimmedMeterMath(motion.displacement)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

function AnimatedTrain({ motion }: { motion: GlbbMotionState }) {
  const playing = useVisualScene((card) => card.playing, false);
  const groupRef = useRef<Group>(null);
  const elapsedRef = useRef(0);
  const scenarioRef = useRef<GlbbScenarioId>(motion.scenario.id);

  useVisualStop(() => {
    elapsedRef.current = 0;
    groupRef.current?.position.set(motion.trainStartX, 0.05, 0);
  });

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    if (scenarioRef.current !== motion.scenario.id) {
      scenarioRef.current = motion.scenario.id;
      elapsedRef.current = 0;
    }

    if (playing) {
      elapsedRef.current += simulationStep(delta);
    }

    const time = getGlbbLoopTime(motion, elapsedRef.current);
    const sample = getGlbbPositionSample(
      motion.scenario,
      time,
      motion.trainStartX
    );

    groupRef.current.position.set(sample.x, 0.05, 0);
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <CameraBounds
        motion={{
          translation: {
            x: {
              min: motion.trainStartX,
              max: motion.trainStartX + motion.worldDisplacement,
            },
            y: { min: 0.05, max: 0.05 },
            z: { min: 0, max: 0 },
          },
        }}
        objectRef={groupRef}
      >
        <group scale={GLBB_SCENE.railGap / RAILCAR.gauge}>
          <Railcar color={GLBB_COLORS.trainBody} />
        </group>
      </CameraBounds>
    </>
  );
}

function PositionMarkers({ motion }: { motion: GlbbMotionState }) {
  const firstSample = motion.positionSamples[0];
  const lastSample = Arr.last(motion.positionSamples);
  const traceLength =
    firstSample && Option.isSome(lastSample)
      ? lastSample.value.x - firstSample.x
      : 0;
  const traceCenterX =
    firstSample && Option.isSome(lastSample)
      ? firstSample.x + traceLength / 2
      : 0;

  return (
    <group>
      {traceLength > 0 ? (
        <mesh
          position={[traceCenterX, 0.055, GLBB_SCENE.markerSideOffset]}
          receiveShadow
        >
          <boxGeometry args={[traceLength, 0.028, 0.07]} />
          <meshStandardMaterial color={motion.scenario.color} roughness={0.5} />
        </mesh>
      ) : null}

      {Arr.map(motion.positionSamples, (sample) => (
        <mesh
          key={sample.time}
          position={[sample.x, 0.075, GLBB_SCENE.markerSideOffset]}
          receiveShadow
        >
          <cylinderGeometry
            args={[
              GLBB_SCENE.markerRadius,
              GLBB_SCENE.markerRadius,
              GLBB_SCENE.markerHeight,
              32,
            ]}
          />
          <meshStandardMaterial
            color={motion.scenario.color}
            roughness={0.48}
          />
        </mesh>
      ))}
    </group>
  );
}
