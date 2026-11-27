import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { SportsBall } from "@repo/design-system/components/contents/physics/kinematics/ball";
import {
  formatRoundedSpeedMath,
  formatTrimmedMeterMath,
  formatTrimmedSecondMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

const MODES = ["throw", "drop"] as const;
const GRAVITY = 10;
const WORLD_SCALE = 0.12;
const BALL_RADIUS = 0.22;
const PAUSE_SECONDS = 0.9;
const CAMERA_POSITION = [2.95, 2.35, 4.75] as const;
const CAMERA_TARGET = [0.05, 1.32, 0] as const;
const TRAIL_POINT_COUNT = 8;
const HEIGHT_MARKS = [0, 5, 10, 15, 20] as const;
const TOWER_X = -0.82;
const TOWER_HEIGHT = 20 * WORLD_SCALE + 0.34;

type Mode = (typeof MODES)[number];

interface VerticalMovementLabProps {
  decimalSeparator?: DecimalSeparator;
  description: NonNullable<ReactNode>;
  labels: {
    condition: string;
    finalVelocity: ReactNode;
    initialCondition: ReactNode;
    maxHeight: ReactNode;
    modeLabels: Record<Mode, ReactNode>;
    time: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
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
        <ScienceStage
          floor={0}
          frameloop="always"
          ground="grass"
          reach={4.5}
          setting="field"
        >
          <Suspense>
            <CameraControls
              cameraPosition={CAMERA_POSITION}
              cameraTarget={CAMERA_TARGET}
              enablePan
              enableRotate
              enableZoom
              fov={40}
            />
            <ResetBridge onReset={() => setMode("throw")} />
            <DropTower mode={mode} />
            <VerticalTrail motion={motion} />
            <AnimatedBall motion={motion} />
          </Suspense>
        </ScienceStage>
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

function ResetBridge({ onReset }: { readonly onReset: () => void }) {
  useVisualReset(onReset);
  return null;
}

/** Concrete target pad, graduated steel measuring tower with 5 m height ticks, and top release arm. */
function DropTower({ mode }: { readonly mode: Mode }) {
  return (
    <group>
      {/* Concrete target landing pad with concentric painted bullseye ring */}
      <mesh castShadow position={[0, 0.025, 0]} receiveShadow>
        <cylinderGeometry args={[0.72, 0.78, 0.05, 48]} />
        <SurfaceMaterial color={MACHINE_COLORS.concrete} surface="concrete" />
      </mesh>
      <mesh position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.45, 48]} />
        <meshStandardMaterial color={ROAD_COLORS.roadPaint} roughness={0.75} />
      </mesh>
      {/* Pneumatic launch ring collar for upward throw mode */}
      {mode === "throw" ? (
        <mesh castShadow position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.25, 0.03, 12, 36]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.38} />
        </mesh>
      ) : null}

      {/* Steel drop-measurement mast with 5 m calibration collars */}
      <group position={[TOWER_X, 0, -0.1]}>
        <RoundedBox
          args={[0.52, 0.1, 0.52]}
          castShadow
          position={[0, 0.05, 0]}
          radius={0.02}
          receiveShadow
          smoothness={2}
        >
          <SurfaceMaterial color={MACHINE_COLORS.concrete} surface="concrete" />
        </RoundedBox>
        <mesh castShadow position={[0, TOWER_HEIGHT / 2 + 0.06, 0]}>
          <cylinderGeometry args={[0.042, 0.052, TOWER_HEIGHT, 24]} />
          <MetalMaterial color={INSTRUMENT_COLORS.aluminium} roughness={0.32} />
        </mesh>
        {/* Cantilever release gantry arm at 20 m */}
        <mesh
          castShadow
          position={[
            Math.abs(TOWER_X) / 2,
            20 * WORLD_SCALE + BALL_RADIUS + 0.12,
            0.05,
          ]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry
            args={[0.026, 0.026, Math.abs(TOWER_X) + 0.12, 16]}
          />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.42} />
        </mesh>
        <mesh
          castShadow
          position={[
            Math.abs(TOWER_X),
            20 * WORLD_SCALE + BALL_RADIUS + 0.08,
            0.1,
          ]}
        >
          <cylinderGeometry args={[0.09, 0.09, 0.06, 20]} />
          <MetalMaterial
            color={
              mode === "drop" ? INSTRUMENT_COLORS.brass : CAR_COLORS.castIron
            }
            roughness={0.3}
          />
        </mesh>
        {Arr.map(HEIGHT_MARKS, (meters) => {
          const y = meters * WORLD_SCALE + BALL_RADIUS;
          return (
            <group key={meters} position={[0, y, 0]}>
              <mesh position={[0.1, 0, 0]}>
                <boxGeometry args={[0.18, 0.018, 0.024]} />
                <MetalMaterial
                  color={INSTRUMENT_COLORS.brass}
                  roughness={0.28}
                />
              </mesh>
              <ThreeLabel
                anchorX="right"
                color={CAR_COLORS.tyre}
                fontSize={0.085}
                position={[-0.12, 0, 0]}
              >
                <span>{`${meters} m`}</span>
              </ThreeLabel>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function VerticalTrail({ motion }: { motion: MotionState }) {
  return (
    <group>
      {Arr.makeBy(TRAIL_POINT_COUNT, (index) => {
        const progress = index / (TRAIL_POINT_COUNT - 1);
        const height =
          getHeight(motion, motion.motionTime * progress) * WORLD_SCALE +
          BALL_RADIUS;

        return (
          <mesh
            key={`trail-${progress}`}
            position={[0, height, -0.3]}
            scale={1 - index * 0.04}
          >
            <sphereGeometry args={[0.038, 14, 10]} />
            <meshStandardMaterial
              color={PLOT_COLORS.amber}
              emissive={PLOT_COLORS.amber}
              emissiveIntensity={0.4}
              opacity={0.55}
              transparent
            />
          </mesh>
        );
      })}
    </group>
  );
}

function AnimatedBall({ motion }: { motion: MotionState }) {
  const playing = useVisualScene((card) => card.playing, false);
  const ballRef = useRef<Group>(null);
  const elapsedRef = useRef(0.55);
  const conditionRef = useRef<string | null>(null);

  useVisualStop(() => {
    elapsedRef.current = 0;
    if (ballRef.current) {
      ballRef.current.position.y =
        motion.startHeight * WORLD_SCALE + BALL_RADIUS;
      ballRef.current.rotation.x = 0;
    }
  });

  useFrame((_, delta) => {
    if (!ballRef.current) {
      return;
    }

    const animationCondition = getInitialConditionKey(motion);
    if (conditionRef.current !== animationCondition) {
      conditionRef.current = animationCondition;
      elapsedRef.current = 0.55;
    }

    const loopSeconds = motion.motionTime + PAUSE_SECONDS;
    if (playing) {
      elapsedRef.current =
        (elapsedRef.current + simulationStep(delta)) % loopSeconds;
    }

    const time = Math.min(elapsedRef.current, motion.motionTime);
    const height = getHeight(motion, time);

    ballRef.current.position.y = height * WORLD_SCALE + BALL_RADIUS;
    ballRef.current.rotation.x = -elapsedRef.current * 2.3;
  });

  return (
    <>
      <SimulationTicker running={playing} />
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
        <SportsBall color={PLOT_COLORS.orange} radius={BALL_RADIUS} />
      </CameraBounds>
    </>
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
