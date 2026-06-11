"use client";

import { useFrame } from "@react-three/fiber";
import { PhysicsCarModel } from "@repo/design-system/components/contents/physics/kinematics/car-model";
import {
  formatSignedSpeedMath,
  getRelativeMovementState,
  isRelativeMovementCaseId,
  RELATIVE_MOVEMENT_CAMERA,
  RELATIVE_MOVEMENT_CASE_IDS,
  RELATIVE_MOVEMENT_OBSERVER_CAR_MODEL_PATH,
  RELATIVE_MOVEMENT_SCENE,
  RELATIVE_MOVEMENT_TARGET_CAR_MODEL_PATH,
  type RelativeMovementCaseId,
  type RelativeMovementLabProps,
  type RelativeMovementState,
} from "@repo/design-system/components/contents/physics/kinematics/relative-movement/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

const OBSERVER_COLOR = getColor("TEAL");
const TARGET_COLOR = getColor("ORANGE", 500);
const CAR_SCALE = 0.58;
const MIN_LOOP_SECONDS = 6.5;
const MAX_LOOP_SECONDS = 10.5;
const MAX_RELATIVE_SPEED = 24;
const SHADOW_CAMERA_RADIUS =
  RELATIVE_MOVEMENT_SCENE.roadLength / 2 + RELATIVE_MOVEMENT_SCENE.roadWidth;

export function RelativeMovementLab({
  title,
  description,
  labels,
}: RelativeMovementLabProps) {
  const [caseId, setCaseId] =
    useState<RelativeMovementCaseId>("same-direction");
  const motion = useMemo(() => getRelativeMovementState(caseId), [caseId]);

  function handleCaseChange(value: string) {
    if (!isRelativeMovementCaseId(value)) {
      return;
    }

    setCaseId(value);
  }

  return (
    <Frame className="overflow-hidden content-auto-card">
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>

      <FramePanel className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseCase}
          gridColumns="2"
          onValueChange={handleCaseChange}
          type="single"
          value={caseId}
          variant="outline"
        >
          {RELATIVE_MOVEMENT_CASE_IDS.map((caseOption) => (
            <ToggleGroupItem key={caseOption} value={caseOption}>
              {labels.modeLabels[caseOption]}
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
              position: RELATIVE_MOVEMENT_CAMERA.cameraPosition,
            }}
            frameloop="always"
          >
            <Suspense>
              <ambientLight intensity={0.7} />
              <hemisphereLight
                color={getColor("SLATE", 50)}
                groundColor={getColor("SLATE")}
                intensity={0.6}
              />
              <directionalLight
                castShadow
                intensity={1.25}
                position={[3.4, 5.4, 4.2]}
                shadow-bias={-0.0006}
                shadow-camera-bottom={-SHADOW_CAMERA_RADIUS}
                shadow-camera-left={-SHADOW_CAMERA_RADIUS}
                shadow-camera-right={SHADOW_CAMERA_RADIUS}
                shadow-camera-top={SHADOW_CAMERA_RADIUS}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <RelativeMovementCamera />
              <RelativeMovementScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </FramePanel>

      <FrameFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <LabFact
            indicatorColor={OBSERVER_COLOR}
            label={labels.factLabels.observer}
            value={
              <InlineMath math={formatSignedSpeedMath(motion.observerSpeed)} />
            }
          />
          <LabFact
            indicatorColor={TARGET_COLOR}
            label={labels.factLabels.target}
            value={
              <InlineMath math={formatSignedSpeedMath(motion.targetSpeed)} />
            }
          />
          <LabFact
            label={labels.factLabels.relativeVelocity}
            value={
              <InlineMath
                math={`v_{B/A}=${formatSignedSpeedMath(
                  motion.relativeVelocity
                )}`}
              />
            }
          />
          <LabFact
            label={labels.factLabels.visibleDirection}
            value={labels.directionLabels[motion.relativeDirection]}
          />
        </dl>
      </FrameFooter>
    </Frame>
  );
}

function RelativeMovementCamera() {
  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={RELATIVE_MOVEMENT_CAMERA.cameraPosition}
      cameraTarget={RELATIVE_MOVEMENT_CAMERA.cameraTarget}
      enablePan
      enableRotate
      enableZoom
      maxDistance={16}
      minDistance={3}
    />
  );
}

function RelativeMovementScene({ motion }: { motion: RelativeMovementState }) {
  return (
    <group>
      <Road />
      <AnimatedCarPair motion={motion} />
    </group>
  );
}

function AnimatedCarPair({ motion }: { motion: RelativeMovementState }) {
  const observerRef = useRef<Group>(null);
  const targetRef = useRef<Group>(null);
  const animationStartRef = useRef<number | null>(null);
  const animationCaseRef = useRef<RelativeMovementCaseId | null>(null);

  useFrame((state) => {
    if (!(observerRef.current && targetRef.current)) {
      return;
    }

    if (
      animationStartRef.current === null ||
      animationCaseRef.current !== motion.caseId
    ) {
      animationCaseRef.current = motion.caseId;
      animationStartRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - animationStartRef.current;
    const positions = getCarPositions(motion, elapsed);

    observerRef.current.position.x = positions.observerX;
    targetRef.current.position.x = positions.targetX;
  });

  return (
    <>
      <group
        position={[0, 0.025, RELATIVE_MOVEMENT_SCENE.laneOffset]}
        ref={observerRef}
      >
        <Car
          accentColor={OBSERVER_COLOR}
          heading="right"
          modelPath={RELATIVE_MOVEMENT_OBSERVER_CAR_MODEL_PATH}
        />
      </group>
      <group
        position={[0, 0.025, -RELATIVE_MOVEMENT_SCENE.laneOffset]}
        ref={targetRef}
      >
        <Car
          accentColor={TARGET_COLOR}
          heading={motion.targetHeading}
          modelPath={RELATIVE_MOVEMENT_TARGET_CAR_MODEL_PATH}
        />
      </group>
    </>
  );
}

function Car({
  accentColor,
  heading,
  modelPath,
  position,
}: {
  accentColor: string;
  heading: "left" | "right";
  modelPath: string;
  position?: [number, number, number];
}) {
  const yRotation = heading === "right" ? Math.PI / 2 : -Math.PI / 2;

  return (
    <group position={position} rotation={[0, yRotation, 0]} scale={CAR_SCALE}>
      <PhysicsCarModel bodyColor={accentColor} modelPath={modelPath} />
    </group>
  );
}

function Road() {
  const stripeCount = Math.ceil(
    RELATIVE_MOVEMENT_SCENE.roadLength / RELATIVE_MOVEMENT_SCENE.stripeSpacing
  );
  const stripePositions = Array.from({ length: stripeCount }, (_, index) => {
    const spacing = RELATIVE_MOVEMENT_SCENE.roadLength / stripeCount;
    return (
      -RELATIVE_MOVEMENT_SCENE.roadLength / 2 + spacing * index + spacing * 0.5
    );
  });

  return (
    <group>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry
          args={[
            RELATIVE_MOVEMENT_SCENE.roadLength,
            0.08,
            RELATIVE_MOVEMENT_SCENE.roadWidth,
          ]}
        />
        <meshStandardMaterial color={getColor("SLATE", 700)} roughness={0.74} />
      </mesh>

      {stripePositions.map((x) => (
        <mesh key={x} position={[x, 0.035, 0]}>
          <boxGeometry args={[0.38, 0.018, 0.06]} />
          <meshStandardMaterial
            color={getColor("SLATE", 50)}
            roughness={0.58}
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

function getCarPositions(
  motion: RelativeMovementState,
  elapsedSeconds: number
) {
  const initialPositions = getInitialCarPositions(motion);
  const loopSeconds = getLoopSeconds(motion);
  const time = elapsedSeconds % loopSeconds;
  const sceneUnitsPerMeter = getSceneUnitsPerMeter(motion, loopSeconds);

  return {
    observerX:
      initialPositions.observerX +
      motion.observerSpeed * sceneUnitsPerMeter * time,
    targetX:
      initialPositions.targetX + motion.targetSpeed * sceneUnitsPerMeter * time,
  };
}

function getInitialCarPositions(motion: RelativeMovementState) {
  const targetStartDirection = getTargetStartDirection(motion);
  const gap = isOppositeDirection(motion)
    ? RELATIVE_MOVEMENT_SCENE.oppositeDirectionGap
    : RELATIVE_MOVEMENT_SCENE.relativeGap;
  const centerX = isOppositeDirection(motion)
    ? 0
    : -RELATIVE_MOVEMENT_SCENE.carTravelRange / 3;
  const targetOffset = (targetStartDirection * gap) / 2;

  return {
    observerX: centerX - targetOffset,
    targetX: centerX + targetOffset,
  };
}

function getTargetStartDirection(motion: RelativeMovementState) {
  if (isOppositeDirection(motion)) {
    return 1;
  }

  return motion.relativeVelocity < 0 ? 1 : -1;
}

function getSceneUnitsPerMeter(
  motion: RelativeMovementState,
  loopSeconds: number
) {
  const maxSpeed = Math.max(
    Math.abs(motion.observerSpeed),
    Math.abs(motion.targetSpeed)
  );

  return RELATIVE_MOVEMENT_SCENE.carTravelRange / (maxSpeed * loopSeconds);
}

function isOppositeDirection(motion: RelativeMovementState) {
  return Math.sign(motion.observerSpeed) !== Math.sign(motion.targetSpeed);
}

function getLoopSeconds(motion: RelativeMovementState) {
  const speedRatio = Math.abs(motion.relativeVelocity) / MAX_RELATIVE_SPEED;

  return lerp(MAX_LOOP_SECONDS, MIN_LOOP_SECONDS, speedRatio);
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}
