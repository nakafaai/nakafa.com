"use client";

import { useFrame } from "@react-three/fiber";
import { PhysicsCarModel } from "@repo/design-system/components/contents/physics/kinematics/car-model";
import {
  formatMeterMath,
  formatSecondMath,
  formatSpeedMath,
  getUniformLinearMotionState,
  isUniformLinearMotionSpeed,
  UNIFORM_LINEAR_MOTION_CAMERA,
  UNIFORM_LINEAR_MOTION_CAR_MODEL_PATH,
  UNIFORM_LINEAR_MOTION_COLORS,
  UNIFORM_LINEAR_MOTION_COPY,
  UNIFORM_LINEAR_MOTION_SCENE,
  UNIFORM_LINEAR_MOTION_SPEEDS,
  type UniformLinearMotionLocale,
  type UniformLinearMotionSpeed,
  type UniformLinearMotionState,
} from "@repo/design-system/components/contents/physics/kinematics/uniform-linear-motion/data";
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
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

const PAUSE_SECONDS = 0.8;
const ROAD_Y = -0.02;
const POSITION_MARK_Y = 0.08;
const TRACK_Z = UNIFORM_LINEAR_MOTION_SCENE.roadWidth * 0.22;

export function UniformLinearMotionLab({
  locale,
}: {
  locale: UniformLinearMotionLocale;
}) {
  const [speed, setSpeed] = useState<UniformLinearMotionSpeed>(4);
  const labels = UNIFORM_LINEAR_MOTION_COPY[locale];
  const motion = useMemo(() => getUniformLinearMotionState(speed), [speed]);
  const facts = [
    {
      label: labels.speed,
      value: <InlineMath math={formatSpeedMath(motion.speed)} />,
    },
    {
      label: labels.positionStep,
      value: <InlineMath math={formatSecondMath(motion.timeStep)} />,
    },
    {
      indicatorColor: UNIFORM_LINEAR_MOTION_COLORS.positionMark,
      label: labels.stepDistance,
      value: <InlineMath math={formatMeterMath(motion.stepDistance)} />,
    },
    {
      label: labels.duration,
      value: <InlineMath math={formatSecondMath(motion.duration)} />,
    },
  ];

  function handleSpeedChange(value: string) {
    if (!value) {
      return;
    }

    const nextSpeed = Number(value);

    if (!isUniformLinearMotionSpeed(nextSpeed)) {
      return;
    }

    setSpeed(nextSpeed);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseSpeed}
          className="grid w-full grid-cols-3"
          layout="grid"
          onValueChange={handleSpeedChange}
          type="single"
          value={String(speed)}
          variant="outline"
        >
          {UNIFORM_LINEAR_MOTION_SPEEDS.map((speedOption) => (
            <ToggleGroupItem key={speedOption} value={String(speedOption)}>
              <InlineMath math={formatSpeedMath(speedOption)} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <section
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas
            camera={{
              fov: 43,
              position: UNIFORM_LINEAR_MOTION_CAMERA.cameraPosition,
            }}
            frameloop="always"
          >
            <Suspense>
              <ambientLight intensity={0.72} />
              <hemisphereLight
                color={getColor("SLATE", 50)}
                groundColor={getColor("SLATE")}
                intensity={0.65}
              />
              <directionalLight
                castShadow
                intensity={1.35}
                position={[3.4, 5.4, 4.8]}
                shadow-bias={-0.0006}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <CameraControls
                autoRotate={false}
                cameraPosition={UNIFORM_LINEAR_MOTION_CAMERA.cameraPosition}
                cameraTarget={UNIFORM_LINEAR_MOTION_CAMERA.cameraTarget}
                enablePan
                enableRotate
                enableZoom
                maxDistance={18}
                minDistance={3}
              />
              <UniformLinearMotionScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {facts.map((fact) => (
            <div className="flex min-w-0 flex-col gap-1" key={fact.label}>
              <dt className="flex items-center gap-2 text-muted-foreground">
                {fact.indicatorColor ? (
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ backgroundColor: fact.indicatorColor }}
                  />
                ) : null}
                {fact.label}
              </dt>
              <dd className="wrap-break-word text-foreground tabular-nums">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardFooter>
    </Card>
  );
}

function UniformLinearMotionScene({
  motion,
}: {
  motion: UniformLinearMotionState;
}) {
  return (
    <group>
      <Road roadLength={motion.roadLength} />
      <mesh position={[motion.trackCenterX, 0.045, TRACK_Z]}>
        <boxGeometry args={[motion.trackLength, 0.03, 0.08]} />
        <meshStandardMaterial
          color={UNIFORM_LINEAR_MOTION_COLORS.track}
          roughness={0.44}
        />
      </mesh>
      {motion.samples.map((sample) => (
        <mesh key={sample.time} position={[sample.x, POSITION_MARK_Y, TRACK_Z]}>
          <cylinderGeometry args={[0.13, 0.13, 0.12, 24]} />
          <meshStandardMaterial
            color={UNIFORM_LINEAR_MOTION_COLORS.positionMark}
            roughness={0.48}
          />
        </mesh>
      ))}
      <AnimatedCar motion={motion} />
    </group>
  );
}

function AnimatedCar({ motion }: { motion: UniformLinearMotionState }) {
  const groupRef = useRef<Group>(null);
  const animationStartRef = useRef<number | null>(null);
  const animationSpeedRef = useRef<UniformLinearMotionSpeed | null>(null);

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    if (
      animationStartRef.current === null ||
      animationSpeedRef.current !== motion.speed
    ) {
      animationSpeedRef.current = motion.speed;
      animationStartRef.current = state.clock.elapsedTime;
    }

    const elapsed =
      (state.clock.elapsedTime - animationStartRef.current) %
      (motion.duration + PAUSE_SECONDS);
    const carX = getAnimatedCarX(motion, elapsed);
    groupRef.current.position.set(carX, 0.025, 0);
  });

  return (
    <group ref={groupRef} rotation={[0, Math.PI / 2, 0]} scale={0.66}>
      <PhysicsCarModel
        bodyColor={UNIFORM_LINEAR_MOTION_COLORS.car}
        modelPath={UNIFORM_LINEAR_MOTION_CAR_MODEL_PATH}
      />
    </group>
  );
}

function Road({ roadLength }: { roadLength: number }) {
  const stripeCount = Math.ceil(
    roadLength / UNIFORM_LINEAR_MOTION_SCENE.stripeSpacing
  );
  const stripePositions = Array.from({ length: stripeCount }, (_, index) => {
    const spacing = roadLength / stripeCount;
    return -roadLength / 2 + spacing * index + spacing * 0.5;
  });

  return (
    <group>
      <mesh position={[0, ROAD_Y, 0]} receiveShadow>
        <boxGeometry
          args={[roadLength, 0.08, UNIFORM_LINEAR_MOTION_SCENE.roadWidth]}
        />
        <meshStandardMaterial
          color={UNIFORM_LINEAR_MOTION_COLORS.road}
          roughness={0.72}
        />
      </mesh>

      {stripePositions.map((x) => (
        <mesh key={x} position={[x, 0.035, 0]}>
          <boxGeometry
            args={[
              UNIFORM_LINEAR_MOTION_SCENE.stripeLength,
              0.018,
              UNIFORM_LINEAR_MOTION_SCENE.stripeWidth,
            ]}
          />
          <meshStandardMaterial
            color={UNIFORM_LINEAR_MOTION_COLORS.stripe}
            roughness={0.58}
          />
        </mesh>
      ))}
    </group>
  );
}

function getAnimatedCarX(
  motion: UniformLinearMotionState,
  elapsedSeconds: number
) {
  if (elapsedSeconds >= motion.duration) {
    return motion.endX;
  }

  const progress = elapsedSeconds / motion.duration;

  return lerp(motion.startX, motion.endX, progress);
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}
