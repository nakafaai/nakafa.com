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
  UNIFORM_CIRCULAR_MOTION_COPY,
  UNIFORM_CIRCULAR_MOTION_PERIODS,
  UNIFORM_CIRCULAR_MOTION_SCENE,
  type UniformCircularMotionLocale,
  type UniformCircularMotionPeriod,
  type UniformCircularMotionState,
} from "@repo/design-system/components/contents/physics/kinematics/uniform-circular-motion/data";
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
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import { DoubleSide, type Group } from "three";

interface UniformCircularMotionLabProps {
  locale: UniformCircularMotionLocale;
}

export function UniformCircularMotionLab({
  locale,
}: UniformCircularMotionLabProps) {
  const [period, setPeriod] = useState<UniformCircularMotionPeriod>(6);
  const labels = UNIFORM_CIRCULAR_MOTION_COPY[locale];
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
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.choosePeriod}
          className="grid w-full grid-cols-3"
          layout="grid"
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
                color="#f8fafc"
                groundColor="#64748b"
                intensity={0.6}
              />
              <directionalLight
                castShadow
                intensity={1.25}
                position={[3.5, 6, 4.5]}
                shadow-bias={-0.0006}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <CircularMotionCamera />
              <CircularMotionScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </CardContent>

      <CardFooter className="border-t">
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
                  locale
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
                  locale
                )}\\text{ m/s}^2`}
              />
            }
          />
        </dl>
      </CardFooter>
    </Card>
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
      <CircularCar key={motion.period} motion={motion} />
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
          color="#334155"
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
          <meshStandardMaterial color="#f8fafc" roughness={0.58} />
        </mesh>
      ))}
    </group>
  );
}

function CircularCar({ motion }: { motion: UniformCircularMotionState }) {
  const groupRef = useRef<Group>(null);
  const animationStartRef = useRef<number | null>(null);

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    if (animationStartRef.current === null) {
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
      <CarContactShadow />
      <CarModel />
    </group>
  );
}

function CarModel() {
  return <PhysicsCarModel modelPath={UNIFORM_CIRCULAR_MOTION_CAR_MODEL_PATH} />;
}

function CarContactShadow() {
  return (
    <mesh
      position={[0, 0.012, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[1.45, 0.52, 1]}
    >
      <circleGeometry args={[0.7, 32]} />
      <meshBasicMaterial
        color="#0f172a"
        depthWrite={false}
        opacity={0.16}
        transparent
      />
    </mesh>
  );
}

function LabFact({ label, value }: { label: string; value: ReactNode }) {
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
