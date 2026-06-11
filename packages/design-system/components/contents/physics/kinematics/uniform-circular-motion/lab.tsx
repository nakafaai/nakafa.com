"use client";

import { useFrame } from "@react-three/fiber";
import { PhysicsCarModel } from "@repo/design-system/components/contents/physics/kinematics/car-model";
import {
  formatCircularMotionDecimal,
  formatPeriodMath,
  formatRadiusMath,
  getUniformCircularMotionState,
  isUniformCircularMotionPeriod,
  UNIFORM_CIRCULAR_MOTION_CAMERA,
  UNIFORM_CIRCULAR_MOTION_CAR_MODEL_PATH,
  UNIFORM_CIRCULAR_MOTION_COLORS,
  UNIFORM_CIRCULAR_MOTION_PERIODS,
  UNIFORM_CIRCULAR_MOTION_SCENE,
  type UniformCircularMotionLabProps,
  type UniformCircularMotionPeriod,
  type UniformCircularMotionState,
} from "@repo/design-system/components/contents/physics/kinematics/uniform-circular-motion/data";
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
import { DoubleSide, type Group } from "three";

const SHADOW_CAMERA_RADIUS =
  UNIFORM_CIRCULAR_MOTION_SCENE.outerRadius +
  UNIFORM_CIRCULAR_MOTION_SCENE.carScale;

export function UniformCircularMotionLab({
  decimalSeparator,
  title,
  description,
  labels,
}: UniformCircularMotionLabProps) {
  const [period, setPeriod] = useState<UniformCircularMotionPeriod>(6);
  const motion = useMemo(() => getUniformCircularMotionState(period), [period]);

  function handlePeriodChange(value: string) {
    if (!value) {
      return;
    }

    const nextPeriod = Number(value);

    if (!isUniformCircularMotionPeriod(nextPeriod)) {
      return;
    }

    setPeriod(nextPeriod);
  }

  return (
    <Frame className="overflow-hidden content-auto-card">
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>

      <FramePanel className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.choosePeriod}
          gridColumns="3"
          onValueChange={handlePeriodChange}
          type="single"
          value={String(period)}
          variant="outline"
        >
          {UNIFORM_CIRCULAR_MOTION_PERIODS.map((periodOption) => (
            <ToggleGroupItem key={periodOption} value={String(periodOption)}>
              <InlineMath math={`T=${formatPeriodMath(periodOption)}`} />
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
              position: UNIFORM_CIRCULAR_MOTION_CAMERA.cameraPosition,
            }}
            frameloop="always"
          >
            <Suspense>
              <ambientLight intensity={0.75} />
              <hemisphereLight
                color={getColor("SLATE", 50)}
                groundColor={getColor("SLATE")}
                intensity={0.6}
              />
              <directionalLight
                castShadow
                intensity={1.25}
                position={[3.5, 6, 4.5]}
                shadow-bias={-0.0006}
                shadow-camera-bottom={-SHADOW_CAMERA_RADIUS}
                shadow-camera-left={-SHADOW_CAMERA_RADIUS}
                shadow-camera-right={SHADOW_CAMERA_RADIUS}
                shadow-camera-top={SHADOW_CAMERA_RADIUS}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <CircularMotionCamera />
              <CircularMotionScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </FramePanel>

      <FrameFooter className="border-t">
        <dl className="grid w-full grid-cols-2 gap-4 text-sm lg:grid-cols-4">
          <LabFact
            label={labels.period}
            value={<InlineMath math={formatPeriodMath(motion.period)} />}
          />
          <LabFact
            label={labels.radius}
            value={<InlineMath math={formatRadiusMath(motion.radius)} />}
          />
          <LabFact
            label={labels.speed}
            value={
              <InlineMath
                math={`${formatCircularMotionDecimal(
                  motion.speed,
                  decimalSeparator
                )}\\text{ m/s}`}
              />
            }
          />
          <LabFact
            label={labels.acceleration}
            value={
              <InlineMath
                math={`${formatCircularMotionDecimal(
                  motion.acceleration,
                  decimalSeparator
                )}\\text{ m/s}^2`}
              />
            }
          />
        </dl>
      </FrameFooter>
    </Frame>
  );
}

function CircularMotionCamera() {
  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={UNIFORM_CIRCULAR_MOTION_CAMERA.cameraPosition}
      cameraTarget={UNIFORM_CIRCULAR_MOTION_CAMERA.cameraTarget}
      enablePan
      enableRotate
      enableZoom
      maxDistance={18}
      minDistance={4}
    />
  );
}

function CircularMotionScene({
  motion,
}: {
  motion: UniformCircularMotionState;
}) {
  return (
    <group>
      <CircularTrack />
      <CircularCar motion={motion} />
    </group>
  );
}

function CircularTrack() {
  const {
    innerRadius,
    laneMarkerCount,
    outerRadius,
    radius: trackRadius,
  } = UNIFORM_CIRCULAR_MOTION_SCENE;
  const markerPositions = Array.from({ length: laneMarkerCount }, (_, index) =>
    getPointOnCircle((index / laneMarkerCount) * Math.PI * 2, trackRadius)
  );

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[innerRadius, outerRadius, 128]} />
        <meshStandardMaterial
          color={getColor("SLATE", 700)}
          roughness={0.74}
          side={DoubleSide}
        />
      </mesh>

      {markerPositions.map(({ angle, x, z }) => (
        <mesh
          key={`${x}-${z}`}
          position={[x, 0.035, z]}
          rotation={[0, -angle - Math.PI / 2, 0]}
        >
          <boxGeometry args={[0.46, 0.018, 0.07]} />
          <meshStandardMaterial
            color={getColor("SLATE", 50)}
            roughness={0.58}
          />
        </mesh>
      ))}
    </group>
  );
}

function CircularCar({ motion }: { motion: UniformCircularMotionState }) {
  const groupRef = useRef<Group>(null);
  const animationStartRef = useRef<number | null>(null);
  const animationPeriodRef = useRef<UniformCircularMotionPeriod | null>(null);

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    if (
      animationStartRef.current === null ||
      animationPeriodRef.current !== motion.period
    ) {
      animationPeriodRef.current = motion.period;
      animationStartRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - animationStartRef.current;
    const angle = (elapsed / motion.period) * Math.PI * 2;
    const { x, z } = getPointOnCircle(angle, motion.radius);
    groupRef.current.position.set(x, 0.025, z);
    groupRef.current.rotation.set(0, -angle, 0);
  });

  return (
    <group
      ref={groupRef}
      rotation={[0, 0, 0]}
      scale={UNIFORM_CIRCULAR_MOTION_SCENE.carScale}
    >
      <CarModel />
    </group>
  );
}

function CarModel() {
  return (
    <PhysicsCarModel
      bodyColor={UNIFORM_CIRCULAR_MOTION_COLORS.carBody}
      modelPath={UNIFORM_CIRCULAR_MOTION_CAR_MODEL_PATH}
    />
  );
}

function LabFact({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="wrap-break-word text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function getPointOnCircle(angle: number, radius: number) {
  return {
    angle,
    x: radius * Math.cos(angle),
    z: radius * Math.sin(angle),
  };
}
