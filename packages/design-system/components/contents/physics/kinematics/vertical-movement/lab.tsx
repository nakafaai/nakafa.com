"use client";

import { useFrame } from "@react-three/fiber";
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
import type { Group, MeshBasicMaterial } from "three";

const MODES = ["throw", "drop"] as const;
const GRAVITY = 10;
const WORLD_SCALE = 0.12;
const BALL_RADIUS = 0.24;
const PAUSE_SECONDS = 0.9;
const CAMERA_POSITION = [2.8, 2.6, 4.6] as const;
const CAMERA_TARGET = [0, 1.22, 0] as const;
const TRAIL_POINT_COUNT = 8;
const TRAILING_ZERO_PATTERN = /\.0$/;

type Mode = (typeof MODES)[number];
type Locale = "id" | "en";

const COPY = {
  id: {
    condition: "Kondisi awal",
    description:
      "Pilih cara bola mulai bergerak untuk melihat gravitasi mengubah tinggi dan kecepatannya.",
    finalVelocity: "Kecepatan akhir",
    initialCondition: "Kondisi awal",
    maxHeight: "Tinggi tertinggi",
    modeLabels: {
      drop: "Dijatuhkan",
      throw: "Dilempar ke Atas",
    },
    time: "Waktu gerak",
    title: "Bola pada Gerak Vertikal",
  },
  en: {
    condition: "Initial condition",
    description:
      "Choose how the ball starts moving to see how gravity changes its height and velocity.",
    finalVelocity: "Final velocity",
    initialCondition: "Initial condition",
    maxHeight: "Highest point",
    modeLabels: {
      drop: "Dropped",
      throw: "Thrown Upward",
    },
    time: "Motion time",
    title: "Ball in Vertical Motion",
  },
} as const;

interface VerticalMovementLabProps {
  locale: Locale;
}

export function VerticalMovementLab({ locale }: VerticalMovementLabProps) {
  const [mode, setMode] = useState<Mode>("throw");
  const labels = COPY[locale];
  const motion = useMemo(() => getMotion(mode), [mode]);

  function handleModeChange(value: string) {
    if (!isMode(value)) {
      return;
    }

    setMode(value);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.condition}
          className="grid w-full grid-cols-2"
          layout="grid"
          onValueChange={handleModeChange}
          type="single"
          value={mode}
          variant="outline"
        >
          {MODES.map((modeOption) => (
            <ToggleGroupItem key={modeOption} value={modeOption}>
              {labels.modeLabels[modeOption]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <section
          aria-label={labels.title}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas
            camera={{ fov: 42, position: CAMERA_POSITION }}
            frameloop="always"
          >
            <Suspense>
              <ambientLight intensity={0.72} />
              <hemisphereLight
                color="#f8fafc"
                groundColor="#64748b"
                intensity={0.62}
              />
              <directionalLight
                castShadow
                intensity={1.25}
                position={[4, 5.4, 3.4]}
                shadow-bias={-0.0005}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
              />
              <CameraControls
                autoRotate={false}
                cameraPosition={CAMERA_POSITION}
                cameraTarget={CAMERA_TARGET}
                enablePan
                enableRotate
                enableZoom
                minDistance={2.4}
              />
              <VerticalMotionScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <LabFact
            label={labels.initialCondition}
            value={<InlineMath math={formatInitialConditionMath(motion)} />}
          />
          <LabFact
            label={labels.maxHeight}
            value={<InlineMath math={formatMeter(motion.maxHeight, locale)} />}
          />
          <LabFact
            label={labels.time}
            value={
              <InlineMath math={formatSeconds(motion.motionTime, locale)} />
            }
          />
          <LabFact
            label={labels.finalVelocity}
            value={<InlineMath math={formatSpeed(motion.finalVelocity)} />}
          />
        </dl>
      </CardFooter>
    </Card>
  );
}

function VerticalMotionScene({ motion }: { motion: MotionState }) {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.82, 48]} />
        <meshStandardMaterial color="#e2efe8" roughness={0.8} />
      </mesh>
      <VerticalTrail motion={motion} />
      <AnimatedBall motion={motion} />
    </group>
  );
}

function VerticalTrail({ motion }: { motion: MotionState }) {
  return (
    <group>
      {Array.from({ length: TRAIL_POINT_COUNT }, (_, index) => {
        const progress = index / (TRAIL_POINT_COUNT - 1);
        const height =
          getHeight(motion, motion.motionTime * progress) * WORLD_SCALE +
          BALL_RADIUS;

        return (
          <mesh
            key={`trail-${progress}`}
            position={[0, height, -0.26]}
            scale={1 - index * 0.055}
          >
            <sphereGeometry args={[0.045, 12, 8]} />
            <meshBasicMaterial color="#93c5fd" opacity={0.42} transparent />
          </mesh>
        );
      })}
    </group>
  );
}

function AnimatedBall({ motion }: { motion: MotionState }) {
  const ballRef = useRef<Group>(null);
  const shadowRef = useRef<Group>(null);
  const shadowMaterialRef = useRef<MeshBasicMaterial>(null);
  const animationStartRef = useRef<number | null>(null);
  const animationConditionRef = useRef<string | null>(null);

  useFrame((state) => {
    if (!(ballRef.current && shadowRef.current && shadowMaterialRef.current)) {
      return;
    }

    const animationCondition = getInitialConditionKey(motion);

    if (
      animationStartRef.current === null ||
      animationConditionRef.current !== animationCondition
    ) {
      animationConditionRef.current = animationCondition;
      animationStartRef.current = state.clock.elapsedTime;
    }

    const loopSeconds = motion.motionTime + PAUSE_SECONDS;
    const elapsed =
      (state.clock.elapsedTime - animationStartRef.current) % loopSeconds;
    const time = Math.min(elapsed, motion.motionTime);
    const height = getHeight(motion, time);
    const heightRatio = motion.maxHeight === 0 ? 0 : height / motion.maxHeight;

    ballRef.current.position.y = height * WORLD_SCALE + BALL_RADIUS;
    ballRef.current.rotation.x = -elapsed * 2.3;
    shadowRef.current.scale.setScalar(1 + heightRatio * 0.95);
    shadowMaterialRef.current.opacity = 0.28 - heightRatio * 0.18;
  });

  return (
    <>
      <group ref={shadowRef}>
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.36, 32]} />
          <meshBasicMaterial
            color="#0f172a"
            depthWrite={false}
            opacity={0.28}
            ref={shadowMaterialRef}
            transparent
          />
        </mesh>
      </group>
      <group ref={ballRef}>
        <mesh castShadow>
          <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
          <meshStandardMaterial color="#2563eb" roughness={0.34} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[BALL_RADIUS + 0.004, 0.008, 8, 32]} />
          <meshStandardMaterial color="#bfdbfe" roughness={0.42} />
        </mesh>
      </group>
    </>
  );
}

function LabFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

interface MotionState {
  finalVelocity: number;
  maxHeight: number;
  motionTime: number;
  startHeight: number;
  startVelocity: number;
}

function getMotion(mode: Mode): MotionState {
  const startHeight = mode === "throw" ? 0 : 20;
  const startVelocity = mode === "throw" ? 20 : 0;
  const motionTime =
    mode === "throw"
      ? (2 * startVelocity) / GRAVITY
      : Math.sqrt((2 * startHeight) / GRAVITY);
  const maxHeight = startHeight + startVelocity ** 2 / (2 * GRAVITY);
  const finalVelocity = startVelocity - GRAVITY * motionTime;

  return {
    finalVelocity,
    maxHeight,
    motionTime,
    startHeight,
    startVelocity,
  };
}

function getHeight(motion: MotionState, time: number) {
  const height =
    motion.startHeight +
    motion.startVelocity * time -
    (GRAVITY * time ** 2) / 2;
  return Math.max(0, height);
}

function isMode(value: string): value is Mode {
  return MODES.some((mode) => mode === value);
}

function formatInitialConditionMath(motion: MotionState) {
  return `v_0=${Math.round(motion.startVelocity)}\\text{ m/s},\\quad y_0=${Math.round(motion.startHeight)}\\text{ m}`;
}

function getInitialConditionKey(motion: MotionState) {
  return `${motion.startVelocity}-${motion.startHeight}`;
}

function formatMeter(value: number, locale: Locale) {
  return `${formatDecimal(value, locale)}\\text{ m}`;
}

function formatSeconds(value: number, locale: Locale) {
  return `${formatDecimal(value, locale)}\\text{ s}`;
}

function formatSpeed(value: number) {
  return `${Math.round(value)}\\text{ m/s}`;
}

function formatDecimal(value: number, locale: Locale) {
  const rounded = value.toFixed(1).replace(TRAILING_ZERO_PATTERN, "");
  return locale === "id" ? rounded.replace(".", "{,}") : rounded;
}
