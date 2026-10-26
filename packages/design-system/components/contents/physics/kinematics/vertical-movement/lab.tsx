import { useFrame } from "@react-three/fiber";
import {
  formatRoundedSpeedMath,
  formatTrimmedMeterMath,
  formatTrimmedSecondMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";
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

type Mode = (typeof MODES)[number];

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
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.condition}
          gridColumns="2"
          onValueChange={handleModeChange}
          type="single"
          value={mode}
          variant="outline"
        >
          {Arr.map(MODES, (modeOption) => (
            <ToggleGroupItem key={modeOption} value={modeOption}>
              {labels.modeLabels[modeOption]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ThreeCanvas frameloop="always">
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
              cameraPosition={CAMERA_POSITION}
              cameraTarget={CAMERA_TARGET}
              enablePan
              enableRotate
              enableZoom
              fov={42}
            />
            <VerticalMotionScene>
              <VerticalTrail motion={motion} />
              <AnimatedBall motion={motion} />
            </VerticalMotionScene>
          </Suspense>
        </ThreeCanvas>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.initialCondition}
            value={<InlineMath math={formatInitialConditionMath(motion)} />}
          />
          <VisualFactTabular
            label={labels.maxHeight}
            value={
              <InlineMath
                math={formatTrimmedMeterMath(
                  motion.maxHeight,
                  decimalSeparator
                )}
              />
            }
          />
          <VisualFactTabular
            label={labels.time}
            value={
              <InlineMath
                math={formatTrimmedSecondMath(
                  motion.motionTime,
                  decimalSeparator
                )}
              />
            }
          />
          <VisualFactTabular
            label={labels.finalVelocity}
            value={
              <InlineMath math={formatRoundedSpeedMath(motion.finalVelocity)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** Draws the ground of the vertical motion scene under the trail and the ball it holds. */
function VerticalMotionScene({ children }: { children: ReactNode }) {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.82, 48]} />
        <meshStandardMaterial
          color={getColor("EMERALD", 100)}
          roughness={0.8}
        />
      </mesh>
      {children}
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
    <CameraBounds
      motion={{
        rotation: "x",
        translation: {
          x: { min: 0, max: 0 },
          y: {
            min: BALL_RADIUS,
            max: motion.maxHeight * WORLD_SCALE + BALL_RADIUS,
          },
          z: { min: 0, max: 0 },
        },
      }}
      objectRef={ballRef}
    >
      <group>
        <mesh castShadow>
          <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
          <meshStandardMaterial color={getColor("BLUE")} roughness={0.34} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[BALL_RADIUS + 0.004, 0.008, 8, 32]} />
          <meshStandardMaterial
            color={getColor("BLUE", 200)}
            roughness={0.42}
          />
        </mesh>
      </group>
    </CameraBounds>
  );
}

/** One mode's motion: its start, its peak, its time, and its final speed. */
type MotionState = ReturnType<typeof getMotion>;

function getMotion(mode: Mode) {
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
  return Arr.some(MODES, (mode) => mode === value);
}

function formatInitialConditionMath(motion: MotionState) {
  return `v_0=${Math.round(motion.startVelocity)}\\text{ m/s},\\quad y_0=${Math.round(motion.startHeight)}\\text{ m}`;
}

function getInitialConditionKey(motion: MotionState) {
  return `${motion.startVelocity}-${motion.startHeight}`;
}
