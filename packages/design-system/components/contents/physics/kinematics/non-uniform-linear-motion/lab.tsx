"use client";

import { useFrame } from "@react-three/fiber";
import {
  DEFAULT_GLBB_SCENARIO_ID,
  formatAccelerationMath,
  formatMeterMath,
  formatVelocityMath,
  GLBB_COLORS,
  GLBB_SCENARIOS,
  GLBB_SCENE,
  GLBB_TRAIN_MODEL_PATH,
  type GlbbLabProps,
  type GlbbMotionState,
  type GlbbScenarioId,
  getGlbbLoopTime,
  getGlbbMotionState,
  getGlbbPositionSample,
  isGlbbScenarioId,
} from "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/data";
import { PhysicsTrainModel } from "@repo/design-system/components/contents/physics/kinematics/train-model";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { getColor } from "@repo/design-system/lib/color";
import { type ReactNode, Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

const TRACK_COLOR = getColor("SLATE", 700);
const RAIL_COLOR = getColor("SLATE", 400);
const SLEEPER_COLOR = getColor("STONE", 600);

export function NonUniformLinearMotionLab({
  title,
  description,
  labels,
}: GlbbLabProps) {
  const [scenarioId, setScenarioId] = useState<GlbbScenarioId>(
    DEFAULT_GLBB_SCENARIO_ID
  );
  const motion = useMemo(() => getGlbbMotionState(scenarioId), [scenarioId]);
  const shadowCameraRadius = motion.trackLength / 2 + GLBB_SCENE.trackWidth;

  function handleScenarioChange(value: string) {
    if (!isGlbbScenarioId(value)) {
      return;
    }

    setScenarioId(value);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseScenario}
          gridColumns="3"
          onValueChange={handleScenarioChange}
          type="single"
          value={scenarioId}
          variant="outline"
        >
          {GLBB_SCENARIOS.map((scenario) => (
            <ToggleGroupItem key={scenario.id} value={scenario.id}>
              {labels.scenarioNames[scenario.id]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <section
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas frameloop="always">
            <Suspense>
              <ambientLight intensity={0.72} />
              <hemisphereLight
                color={getColor("SLATE", 50)}
                groundColor={getColor("SLATE")}
                intensity={0.65}
              />
              <directionalLight
                castShadow
                intensity={1.25}
                position={[4, 6, 4]}
                shadow-bias={-0.0006}
                shadow-camera-bottom={-shadowCameraRadius}
                shadow-camera-left={-shadowCameraRadius}
                shadow-camera-right={shadowCameraRadius}
                shadow-camera-top={shadowCameraRadius}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <CameraControls
                autoRotate={false}
                cameraPosition={GLBB_SCENE.cameraPosition}
                cameraTarget={GLBB_SCENE.cameraTarget}
                enablePan
                enableRotate
                enableZoom
                fov={GLBB_SCENE.cameraFov}
                maxDistance={13}
                minDistance={3}
              />
              <GlbbScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <LabFact
            label={labels.factLabels.initialVelocity}
            value={
              <InlineMath
                math={`v_0=${formatVelocityMath(
                  motion.scenario.initialVelocity
                )}`}
              />
            }
          />
          <LabFact
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
          <LabFact
            label={labels.factLabels.finalVelocity}
            value={
              <InlineMath
                math={`v_t=${formatVelocityMath(motion.finalVelocity)}`}
              />
            }
          />
          <LabFact
            label={labels.factLabels.displacement}
            value={
              <InlineMath
                math={`\\Delta x=${formatMeterMath(motion.displacement)}`}
              />
            }
          />
        </dl>
      </CardFooter>
    </Card>
  );
}

function GlbbScene({ motion }: { motion: GlbbMotionState }) {
  return (
    <group>
      <RailTrack trackLength={motion.trackLength} />
      <PositionMarkers motion={motion} />
      <AnimatedTrain motion={motion} />
    </group>
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
    <group
      ref={groupRef}
      rotation={[0, Math.PI / 2, 0]}
      scale={GLBB_SCENE.trainScale}
    >
      <PhysicsTrainModel
        bodyColor={GLBB_COLORS.trainBody}
        modelPath={GLBB_TRAIN_MODEL_PATH}
      />
    </group>
  );
}

function RailTrack({ trackLength }: { trackLength: number }) {
  const sleeperCount = Math.ceil(trackLength / GLBB_SCENE.sleeperSpacing);
  const sleeperSpacing = trackLength / sleeperCount;
  const sleeperPositions = Array.from(
    { length: sleeperCount },
    (_, index) => -trackLength / 2 + sleeperSpacing * (index + 0.5)
  );

  return (
    <group>
      <mesh position={[0, -0.045, 0]} receiveShadow>
        <boxGeometry args={[trackLength, 0.04, GLBB_SCENE.trackWidth]} />
        <meshStandardMaterial color={TRACK_COLOR} roughness={0.8} />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, 0.025, (side * GLBB_SCENE.railGap) / 2]}
          receiveShadow
        >
          <boxGeometry
            args={[trackLength, GLBB_SCENE.railHeight, GLBB_SCENE.railWidth]}
          />
          <meshStandardMaterial
            color={RAIL_COLOR}
            metalness={0.35}
            roughness={0.36}
          />
        </mesh>
      ))}

      {sleeperPositions.map((x) => (
        <mesh key={x} position={[x, -0.005, 0]} receiveShadow>
          <boxGeometry
            args={[
              GLBB_SCENE.sleeperWidth,
              GLBB_SCENE.sleeperHeight,
              GLBB_SCENE.sleeperLength,
            ]}
          />
          <meshStandardMaterial color={SLEEPER_COLOR} roughness={0.76} />
        </mesh>
      ))}
    </group>
  );
}

function PositionMarkers({ motion }: { motion: GlbbMotionState }) {
  const firstSample = motion.positionSamples[0];
  const lastSample = motion.positionSamples.at(-1);
  const traceLength =
    firstSample && lastSample ? lastSample.x - firstSample.x : 0;
  const traceCenterX =
    firstSample && lastSample ? firstSample.x + traceLength / 2 : 0;

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

      {motion.positionSamples.map((sample) => (
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

function LabFact({
  indicatorColor,
  label,
  value,
}: {
  indicatorColor?: string;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {indicatorColor ? (
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: indicatorColor }}
          />
        ) : null}
        {label}
      </dt>
      <dd className="wrap-break-word text-foreground tabular-nums">{value}</dd>
    </div>
  );
}
