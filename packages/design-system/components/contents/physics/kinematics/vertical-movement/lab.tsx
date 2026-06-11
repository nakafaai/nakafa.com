"use client";

import { useFrame } from "@react-three/fiber";
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
type DecimalSeparator = "comma" | "dot";

interface VerticalMovementLabProps {
  decimalSeparator?: DecimalSeparator;
  description: ReactNode;
  labels: {
    condition: string;
    finalVelocity: ReactNode;
    initialCondition: ReactNode;
    maxHeight: ReactNode;
    modeLabels: Record<Mode, ReactNode>;
    time: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

export function VerticalMovementLab({
  decimalSeparator,
  title,
  description,
  labels,
}: VerticalMovementLabProps) {
  const [mode, setMode] = useState<Mode>("throw");
  const motion = useMemo(() => getMotion(mode), [mode]);

  function handleModeChange(value: string) {
    if (!isMode(value)) {
      return;
    }

    setMode(value);
  }

  return (
    <Frame className="overflow-hidden content-auto-card">
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>

      <FramePanel className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.condition}
          gridColumns="2"
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
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas
            camera={{ fov: 42, position: CAMERA_POSITION }}
            frameloop="always"
          >
            <Suspense>
              <ambientLight intensity={0.72} />
              <hemisphereLight
                color={getColor("SLATE", 50)}
                groundColor={getColor("SLATE")}
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
      </FramePanel>

      <FrameFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <LabFact
            label={labels.initialCondition}
            value={<InlineMath math={formatInitialConditionMath(motion)} />}
          />
          <LabFact
            label={labels.maxHeight}
            value={
              <InlineMath
                math={formatMeter(motion.maxHeight, decimalSeparator)}
              />
            }
          />
          <LabFact
            label={labels.time}
            value={
              <InlineMath
                math={formatSeconds(motion.motionTime, decimalSeparator)}
              />
            }
          />
          <LabFact
            label={labels.finalVelocity}
            value={<InlineMath math={formatSpeed(motion.finalVelocity)} />}
          />
        </dl>
      </FrameFooter>
    </Frame>
  );
}

function VerticalMotionScene({ motion }: { motion: MotionState }) {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.82, 48]} />
        <meshStandardMaterial
          color={getColor("EMERALD", 100)}
          roughness={0.8}
        />
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
            <meshBasicMaterial
              color={getColor("BLUE", 300)}
              opacity={0.42}
              transparent
            />
          </mesh>
        );
      })}
    </group>
  );
}

function AnimatedBall({ motion }: { motion: MotionState }) {
  const ballRef = useRef<Group>(null);
  const animationStartRef = useRef<number | null>(null);
  const animationConditionRef = useRef<string | null>(null);

  useFrame((state) => {
    if (!ballRef.current) {
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

    ballRef.current.position.y = height * WORLD_SCALE + BALL_RADIUS;
    ballRef.current.rotation.x = -elapsed * 2.3;
  });

  return (
    <group ref={ballRef}>
      <mesh castShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
        <meshStandardMaterial color={getColor("BLUE")} roughness={0.34} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BALL_RADIUS + 0.004, 0.008, 8, 32]} />
        <meshStandardMaterial color={getColor("BLUE", 200)} roughness={0.42} />
      </mesh>
    </group>
  );
}

function LabFact({ label, value }: { label: ReactNode; value: ReactNode }) {
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

function formatMeter(value: number, decimalSeparator?: DecimalSeparator) {
  return `${formatDecimal(value, decimalSeparator)}\\text{ m}`;
}

function formatSeconds(value: number, decimalSeparator?: DecimalSeparator) {
  return `${formatDecimal(value, decimalSeparator)}\\text{ s}`;
}

function formatSpeed(value: number) {
  return `${Math.round(value)}\\text{ m/s}`;
}

function formatDecimal(value: number, decimalSeparator?: DecimalSeparator) {
  const rounded = value.toFixed(1).replace(TRAILING_ZERO_PATTERN, "");
  return decimalSeparator === "comma" ? rounded.replace(".", "{,}") : rounded;
}
