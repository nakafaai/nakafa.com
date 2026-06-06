"use client";

import { useFrame } from "@react-three/fiber";
import { PhysicsCarModel } from "@repo/design-system/components/contents/physics/kinematics/car-model";
import {
  formatMeterMath,
  formatSpeedMath,
  getStoppingDistanceState,
  isStoppingDistanceSpeed,
  STOPPING_DISTANCE_BRAKING_DECELERATION,
  STOPPING_DISTANCE_CAMERA,
  STOPPING_DISTANCE_CAR_MODEL_PATH,
  STOPPING_DISTANCE_COLORS,
  STOPPING_DISTANCE_REACTION_TIME,
  STOPPING_DISTANCE_SCENE,
  STOPPING_DISTANCE_SPEEDS,
  type StoppingDistanceLabProps,
  type StoppingDistanceSpeed,
  type StoppingDistanceState,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/data";
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
import type { ReactNode, RefObject } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

const PAUSE_SECONDS = 1;
const BRAKE_DUST_PUFF_COUNT = 5;
const ROAD_STRIPE_SPACING = 1.6;
const REACTION_DISTANCE_COLOR = getColor("TEAL");
const BRAKING_DISTANCE_COLOR = getColor("ORANGE", 500);
const DISTANCE_MARKER_Z = STOPPING_DISTANCE_SCENE.roadWidth * 0.2;

export function StoppingDistanceLab({
  title,
  description,
  labels,
}: StoppingDistanceLabProps) {
  const [speed, setSpeed] = useState<StoppingDistanceSpeed>(20);
  const motion = useMemo(() => getStoppingDistanceState(speed), [speed]);

  function handleSpeedChange(value: string) {
    if (!value) {
      return;
    }

    const nextSpeed = Number(value);

    if (!isStoppingDistanceSpeed(nextSpeed)) {
      return;
    }

    setSpeed(nextSpeed);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseSpeed}
          gridColumns="3"
          onValueChange={handleSpeedChange}
          type="single"
          value={String(speed)}
          variant="outline"
        >
          {STOPPING_DISTANCE_SPEEDS.map((speedOption) => (
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
              fov: 44,
              position: STOPPING_DISTANCE_CAMERA.cameraPosition,
            }}
            frameloop="always"
          >
            <Suspense>
              <ambientLight intensity={0.7} />
              <hemisphereLight
                color={getColor("SLATE", 50)}
                groundColor={getColor("SLATE")}
                intensity={0.62}
              />
              <directionalLight
                castShadow
                intensity={1.35}
                position={[3.5, 5.8, 4.5]}
                shadow-bias={-0.0006}
                shadow-camera-bottom={
                  -STOPPING_DISTANCE_SCENE.shadowCameraRadius
                }
                shadow-camera-left={-STOPPING_DISTANCE_SCENE.shadowCameraRadius}
                shadow-camera-right={STOPPING_DISTANCE_SCENE.shadowCameraRadius}
                shadow-camera-top={STOPPING_DISTANCE_SCENE.shadowCameraRadius}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <StoppingDistanceCamera />
              <StoppingDistanceScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-2 gap-4 text-sm lg:grid-cols-4">
          <LabFact
            label={labels.speed}
            value={<InlineMath math={formatSpeedMath(motion.speed)} />}
          />
          <LabFact
            indicatorColor={REACTION_DISTANCE_COLOR}
            label={labels.reactionDistance}
            value={
              <InlineMath math={formatMeterMath(motion.reactionDistance)} />
            }
          />
          <LabFact
            indicatorColor={BRAKING_DISTANCE_COLOR}
            label={labels.brakingDistance}
            value={
              <InlineMath math={formatMeterMath(motion.brakingDistance)} />
            }
          />
          <LabFact
            label={labels.stoppingDistance}
            value={
              <InlineMath math={formatMeterMath(motion.stoppingDistance)} />
            }
          />
        </dl>
      </CardFooter>
    </Card>
  );
}

function StoppingDistanceCamera() {
  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={STOPPING_DISTANCE_CAMERA.cameraPosition}
      cameraTarget={STOPPING_DISTANCE_CAMERA.cameraTarget}
      enablePan
      enableRotate
      enableZoom
      maxDistance={20}
      minDistance={3.1}
    />
  );
}

function StoppingDistanceScene({ motion }: { motion: StoppingDistanceState }) {
  const sceneRef = useRef<Group>(null);

  return (
    <group ref={sceneRef}>
      <Road />
      <DistanceStrip
        color={REACTION_DISTANCE_COLOR}
        endX={motion.reactionEndX}
        startX={motion.startX}
        z={DISTANCE_MARKER_Z}
      />
      <DistanceStrip
        color={BRAKING_DISTANCE_COLOR}
        endX={motion.stopX}
        startX={motion.reactionEndX}
        z={DISTANCE_MARKER_Z}
      />
      <StopCone x={motion.stopX} />
      <AnimatedCar motion={motion} sceneRef={sceneRef} />
    </group>
  );
}

function AnimatedCar({
  motion,
  sceneRef,
}: {
  motion: StoppingDistanceState;
  sceneRef: RefObject<Group | null>;
}) {
  const groupRef = useRef<Group>(null);
  const brakeDustRef = useRef<Group>(null);
  const animationStartRef = useRef<number | null>(null);
  const animationSpeedRef = useRef<StoppingDistanceSpeed | null>(null);

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
      getLoopSeconds(motion);
    const carX = getAnimatedCarX(motion, elapsed);
    groupRef.current.position.set(carX, 0.025, 0);

    if (sceneRef.current) {
      sceneRef.current.position.x = -carX;
    }

    if (!brakeDustRef.current) {
      return;
    }

    const brakingProgress = getBrakingProgress(motion, elapsed);
    brakeDustRef.current.visible = brakingProgress > 0;
    brakeDustRef.current.position.set(carX - 0.76, 0.16, 0);
    const pulse = Math.sin(state.clock.elapsedTime * 9) * 0.1;
    const size = 1 + brakingProgress * 0.42 + pulse;
    brakeDustRef.current.scale.set(size, size, size);
  });

  return (
    <>
      <group ref={groupRef} rotation={[0, Math.PI / 2, 0]} scale={0.66}>
        <CarModel />
      </group>
      <BrakeDust dustRef={brakeDustRef} />
    </>
  );
}

function CarModel() {
  return (
    <PhysicsCarModel
      bodyColor={STOPPING_DISTANCE_COLORS.carBody}
      modelPath={STOPPING_DISTANCE_CAR_MODEL_PATH}
    />
  );
}

function BrakeDust({ dustRef }: { dustRef: RefObject<Group | null> }) {
  const puffPositions = getBrakeDustPuffPositions();

  return (
    <group ref={dustRef} visible={false}>
      {puffPositions.map((position) => (
        <mesh key={position.join("-")} position={position}>
          <sphereGeometry args={[0.3, 12, 8]} />
          <meshBasicMaterial
            color={getColor("GRAY", 200)}
            depthWrite={false}
            opacity={0.78}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function getBrakeDustPuffPositions() {
  const centerIndex = Math.floor(BRAKE_DUST_PUFF_COUNT / 2);

  return Array.from({ length: BRAKE_DUST_PUFF_COUNT }, (_, index) => {
    const offset = index - centerIndex;

    if (offset === 0) {
      return [-0.68, 0.34, 0] satisfies [number, number, number];
    }

    const ring = Math.abs(offset);
    const side = Math.sign(offset);
    const x = -0.18 - (ring - 1) * 0.24;
    const y = 0.3 - (ring - 1) * 0.1;
    const z = side * (0.58 - (ring - 1) * 0.12);

    return [x, y, z] satisfies [number, number, number];
  });
}

function Road() {
  const roadCenterX = STOPPING_DISTANCE_SCENE.roadCenterX;
  const roadLength = STOPPING_DISTANCE_SCENE.roadLength;
  const laneCount = Math.ceil(roadLength / ROAD_STRIPE_SPACING);
  const stripePositions = Array.from({ length: laneCount }, (_, index) => {
    const spacing = roadLength / laneCount;
    return roadCenterX - roadLength / 2 + spacing * index + spacing * 0.5;
  });

  return (
    <group>
      <mesh position={[roadCenterX, -0.02, 0]} receiveShadow>
        <boxGeometry
          args={[roadLength, 0.08, STOPPING_DISTANCE_SCENE.roadWidth]}
        />
        <meshStandardMaterial color={getColor("GRAY", 700)} roughness={0.72} />
      </mesh>

      {stripePositions.map((x) => (
        <mesh key={x} position={[x, 0.035, 0]}>
          <boxGeometry args={[0.42, 0.018, 0.06]} />
          <meshStandardMaterial
            color={getColor("SLATE", 50)}
            roughness={0.58}
          />
        </mesh>
      ))}
    </group>
  );
}

function DistanceStrip({
  color,
  endX,
  startX,
  z,
}: {
  color: string;
  endX: number;
  startX: number;
  z: number;
}) {
  const length = Math.max(0.02, endX - startX);
  const centerX = startX + length / 2;

  return (
    <mesh position={[centerX, 0.045, z]}>
      <boxGeometry args={[length, 0.03, 0.08]} />
      <meshStandardMaterial color={color} roughness={0.44} />
    </mesh>
  );
}

function StopCone({ x }: { x: number }) {
  return (
    <group position={[x, 0.08, DISTANCE_MARKER_Z]}>
      <mesh castShadow rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.17, 0.38, 24]} />
        <meshStandardMaterial color={getColor("ORANGE", 500)} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 24]} />
        <meshStandardMaterial color={getColor("GRAY", 800)} roughness={0.65} />
      </mesh>
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

function getAnimatedCarX(
  motion: StoppingDistanceState,
  elapsedSeconds: number
) {
  if (elapsedSeconds <= STOPPING_DISTANCE_REACTION_TIME) {
    const progress = elapsedSeconds / STOPPING_DISTANCE_REACTION_TIME;
    return lerp(motion.startX, motion.reactionEndX, progress);
  }

  const brakingSeconds = getBrakingSeconds(motion);
  const brakingEnd = STOPPING_DISTANCE_REACTION_TIME + brakingSeconds;

  if (elapsedSeconds <= brakingEnd) {
    const progress =
      (elapsedSeconds - STOPPING_DISTANCE_REACTION_TIME) / brakingSeconds;
    const deceleratingProgress = 2 * progress - progress ** 2;
    return lerp(motion.reactionEndX, motion.stopX, deceleratingProgress);
  }

  if (elapsedSeconds <= brakingEnd + PAUSE_SECONDS) {
    return motion.stopX;
  }

  return motion.startX;
}

function getLoopSeconds(motion: StoppingDistanceState) {
  return (
    STOPPING_DISTANCE_REACTION_TIME + getBrakingSeconds(motion) + PAUSE_SECONDS
  );
}

function getBrakingSeconds(motion: StoppingDistanceState) {
  return motion.speed / STOPPING_DISTANCE_BRAKING_DECELERATION;
}

function getBrakingProgress(
  motion: StoppingDistanceState,
  elapsedSeconds: number
) {
  const brakingSeconds = getBrakingSeconds(motion);
  const brakingEnd = STOPPING_DISTANCE_REACTION_TIME + brakingSeconds;

  if (
    elapsedSeconds <= STOPPING_DISTANCE_REACTION_TIME ||
    elapsedSeconds > brakingEnd
  ) {
    return 0;
  }

  return (elapsedSeconds - STOPPING_DISTANCE_REACTION_TIME) / brakingSeconds;
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}
