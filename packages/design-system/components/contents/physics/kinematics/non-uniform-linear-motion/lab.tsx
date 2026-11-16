import { useFrame } from "@react-three/fiber";
import {
  formatAccelerationMath,
  formatTrimmedMeterMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";
import {
  DEFAULT_GLBB_SCENARIO_ID,
  formatVelocityMath,
  GLBB_COLORS,
  GLBB_SCENARIOS,
  GLBB_SCENE,
  GLBB_TRAIN_MODEL_PATH,
  type GlbbMotionState,
  type GlbbScenarioId,
  getGlbbLoopTime,
  getGlbbMotionState,
  getGlbbPositionSample,
  isGlbbScenarioId,
} from "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/data";
import { PhysicsTrainModel } from "@repo/design-system/components/contents/physics/kinematics/train";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Rail } from "@repo/design-system/components/three/stage/rail";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
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
import { type ReactNode, Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** The height of the bed the rails lie on. */
const BED_Y = -0.025;

interface GlbbLabProps {
  description: ReactNode;
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
  title: ReactNode;
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
            <CameraControls
              cameraPosition={GLBB_SCENE.cameraPosition}
              cameraTarget={GLBB_SCENE.cameraTarget}
              enablePan
              enableRotate
              enableZoom
              fov={GLBB_SCENE.cameraFov}
            />
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
  const groupRef = useRef<Group>(null);
  const animationStartRef = useRef<number | null>(null);
  const scenarioRef = useRef<GlbbScenarioId | null>(null);

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    if (
      animationStartRef.current === null ||
      scenarioRef.current !== motion.scenario.id
    ) {
      scenarioRef.current = motion.scenario.id;
      animationStartRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - animationStartRef.current;
    const time = getGlbbLoopTime(motion, elapsed);
    const sample = getGlbbPositionSample(
      motion.scenario,
      time,
      motion.trainStartX
    );

    groupRef.current.position.set(sample.x, 0.05, 0);
  });

  return (
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
      <group rotation={[0, Math.PI / 2, 0]} scale={GLBB_SCENE.trainScale}>
        <PhysicsTrainModel
          bodyColor={GLBB_COLORS.trainBody}
          modelPath={GLBB_TRAIN_MODEL_PATH}
        />
      </group>
    </CameraBounds>
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
