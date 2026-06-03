"use client";

import { useFrame } from "@react-three/fiber";
import { PhysicsCarModel } from "@repo/design-system/components/contents/physics/kinematics/car-model";
import {
  DEFAULT_INSTANTANEOUS_SPEED_CASE_ID,
  formatSignedSpeedMath,
  formatSpeedMath,
  formatTimeMath,
  getInstantaneousVelocitySpeedState,
  INSTANTANEOUS_SPEED_CAMERA,
  INSTANTANEOUS_SPEED_CAR_MODEL_PATH,
  INSTANTANEOUS_SPEED_CASES,
  INSTANTANEOUS_SPEED_COLORS,
  INSTANTANEOUS_SPEED_COPY,
  INSTANTANEOUS_SPEED_SCENE,
  type InstantaneousSpeedCaseId,
  type InstantaneousVelocitySpeedLocale,
  type InstantaneousVelocitySpeedState,
  isInstantaneousSpeedCaseId,
} from "@repo/design-system/components/contents/physics/kinematics/instantaneous-velocity-speed/data";
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
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

const ROAD_Y = -0.03;

export function InstantaneousVelocitySpeedLab({
  locale,
}: {
  locale: InstantaneousVelocitySpeedLocale;
}) {
  const labels = INSTANTANEOUS_SPEED_COPY[locale];
  const [caseId, setCaseId] = useState<InstantaneousSpeedCaseId>(
    DEFAULT_INSTANTANEOUS_SPEED_CASE_ID
  );
  const motion = useMemo(
    () => getInstantaneousVelocitySpeedState(caseId),
    [caseId]
  );
  const facts = [
    {
      label: labels.factLabels.time,
      math: `t=${formatTimeMath(motion.scenario.time)}`,
    },
    {
      label: labels.factLabels.speed,
      math: formatSpeedMath(motion.scenario.speed),
    },
    {
      label: labels.factLabels.velocity,
      math: formatSignedSpeedMath(motion.velocity),
    },
  ];

  function handleCaseChange(value: string) {
    if (isInstantaneousSpeedCaseId(value)) {
      setCaseId(value);
    }
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseMoment}
          className="grid w-full grid-cols-2"
          layout="grid"
          onValueChange={handleCaseChange}
          type="single"
          value={caseId}
          variant="outline"
        >
          {INSTANTANEOUS_SPEED_CASES.map((scenario) => (
            <ToggleGroupItem key={scenario.id} value={scenario.id}>
              <InlineMath math={`t=${formatTimeMath(scenario.time)}`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <section
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas
            camera={{
              fov: INSTANTANEOUS_SPEED_CAMERA.fov,
              position: INSTANTANEOUS_SPEED_CAMERA.cameraPosition,
            }}
            frameloop="always"
          >
            <Suspense>
              <ambientLight intensity={0.72} />
              <hemisphereLight
                color="#f8fafc"
                groundColor="#64748b"
                intensity={0.64}
              />
              <directionalLight
                castShadow
                intensity={1.35}
                position={[3.4, 5.2, 4.8]}
                shadow-bias={-0.0006}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <CameraControls
                autoRotate={false}
                cameraPosition={INSTANTANEOUS_SPEED_CAMERA.cameraPosition}
                cameraTarget={INSTANTANEOUS_SPEED_CAMERA.cameraTarget}
                enablePan
                enableRotate
                enableZoom
                maxDistance={18}
                minDistance={3}
              />
              <InstantaneousVelocitySpeedScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {facts.map((fact) => (
            <LabFact key={fact.label} label={fact.label} math={fact.math} />
          ))}
        </dl>
      </CardFooter>
    </Card>
  );
}

function InstantaneousVelocitySpeedScene({
  motion,
}: {
  motion: InstantaneousVelocitySpeedState;
}) {
  return (
    <group>
      <Road roadLength={motion.roadLength} />
      <MeasurementPoint x={motion.measurementX} />
      <AnimatedCar motion={motion} />
    </group>
  );
}

function Road({ roadLength }: { roadLength: number }) {
  const stripeCount = Math.ceil(
    roadLength / INSTANTANEOUS_SPEED_SCENE.stripeSpacing
  );
  const stripePositions = Array.from({ length: stripeCount }, (_, index) => {
    const spacing = roadLength / stripeCount;
    return -roadLength / 2 + spacing * index + spacing * 0.5;
  });

  return (
    <group>
      <mesh position={[0, ROAD_Y, 0]} receiveShadow>
        <boxGeometry
          args={[roadLength, 0.08, INSTANTANEOUS_SPEED_SCENE.roadWidth]}
        />
        <meshStandardMaterial
          color={INSTANTANEOUS_SPEED_COLORS.road}
          roughness={0.72}
        />
      </mesh>

      {stripePositions.map((x) => (
        <mesh key={x} position={[x, 0.035, 0]}>
          <boxGeometry
            args={[
              INSTANTANEOUS_SPEED_SCENE.stripeLength,
              0.018,
              INSTANTANEOUS_SPEED_SCENE.stripeWidth,
            ]}
          />
          <meshStandardMaterial
            color={INSTANTANEOUS_SPEED_COLORS.stripe}
            roughness={0.58}
          />
        </mesh>
      ))}
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

      {sensorSides.map((side) => (
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
  const groupRef = useRef<Group>(null);
  const animationStartRef = useRef<number | null>(null);
  const scenarioIdRef = useRef<InstantaneousSpeedCaseId | null>(null);

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    if (
      animationStartRef.current === null ||
      scenarioIdRef.current !== motion.scenario.id
    ) {
      animationStartRef.current = state.clock.elapsedTime;
      scenarioIdRef.current = motion.scenario.id;
    }

    const elapsedSeconds =
      (state.clock.elapsedTime - animationStartRef.current) %
      (motion.loopSeconds + INSTANTANEOUS_SPEED_SCENE.pauseSeconds);
    const carX = getAnimatedCarX(motion, elapsedSeconds);

    groupRef.current.position.set(
      carX,
      0.025,
      INSTANTANEOUS_SPEED_SCENE.trackZ
    );
  });

  return (
    <group
      ref={groupRef}
      rotation={[0, getCarRotationY(motion.scenario.direction), 0]}
      scale={INSTANTANEOUS_SPEED_SCENE.carScale}
    >
      <PhysicsCarModel
        bodyColor={INSTANTANEOUS_SPEED_COLORS.car}
        modelPath={INSTANTANEOUS_SPEED_CAR_MODEL_PATH}
      />
    </group>
  );
}

function LabFact({ label, math }: { label: string; math: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="wrap-break-word text-foreground tabular-nums">
        <InlineMath math={math} />
      </dd>
    </div>
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

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}
