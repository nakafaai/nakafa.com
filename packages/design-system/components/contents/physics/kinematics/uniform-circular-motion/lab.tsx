import { useFrame } from "@react-three/fiber";
import { PhysicsCarModel } from "@repo/design-system/components/contents/physics/kinematics/car";
import {
  formatRoundedMeterMath,
  formatRoundedSecondMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import {
  formatCircularMotionDecimal,
  getUniformCircularMotionState,
  isUniformCircularMotionPeriod,
  UNIFORM_CIRCULAR_MOTION_CAMERA,
  UNIFORM_CIRCULAR_MOTION_CAR_MODEL_PATH,
  UNIFORM_CIRCULAR_MOTION_COLORS,
  UNIFORM_CIRCULAR_MOTION_PERIODS,
  UNIFORM_CIRCULAR_MOTION_SCENE,
  type UniformCircularMotionPeriod,
  type UniformCircularMotionState,
} from "@repo/design-system/components/contents/physics/kinematics/uniform-circular-motion/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Track } from "@repo/design-system/components/three/stage/track";
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
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** How far the lab reaches from its middle, which its shadows cover. */
const SCENE_REACH =
  UNIFORM_CIRCULAR_MOTION_SCENE.radius +
  UNIFORM_CIRCULAR_MOTION_SCENE.trackWidth / 2 +
  UNIFORM_CIRCULAR_MOTION_SCENE.carScale;
/** The height of the track the car drives on. */
const TRACK_Y = 0.01;

interface UniformCircularMotionLabProps {
  decimalSeparator?: DecimalSeparator;
  description: NonNullable<ReactNode>;
  labels: {
    acceleration: ReactNode;
    choosePeriod: string;
    period: ReactNode;
    radius: ReactNode;
    speed: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

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
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.choosePeriod}
          gridColumns="3"
          onValueChange={handlePeriodChange}
          type="single"
          value={String(period)}
          variant="outline"
        >
          {Arr.map(UNIFORM_CIRCULAR_MOTION_PERIODS, (periodOption) => (
            <ToggleGroupItem key={periodOption} value={String(periodOption)}>
              <InlineMath math={`T=${formatRoundedSecondMath(periodOption)}`} />
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
          floor={TRACK_Y}
          frameloop="always"
          ground="grass"
          reach={SCENE_REACH}
          setting="field"
        >
          <Suspense>
            <CircularMotionCamera />
            <group>
              <Track
                dash={UNIFORM_CIRCULAR_MOTION_SCENE.dashLength}
                radius={UNIFORM_CIRCULAR_MOTION_SCENE.radius}
                spacing={UNIFORM_CIRCULAR_MOTION_SCENE.dashSpacing}
                width={UNIFORM_CIRCULAR_MOTION_SCENE.trackWidth}
              />
              <CircularCar motion={motion} />
            </group>
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.period}
            value={<InlineMath math={formatRoundedSecondMath(motion.period)} />}
          />
          <VisualFactTabular
            label={labels.radius}
            value={<InlineMath math={formatRoundedMeterMath(motion.radius)} />}
          />
          <VisualFactTabular
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
          <VisualFactTabular
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
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

function CircularMotionCamera() {
  return (
    <CameraControls
      cameraPosition={UNIFORM_CIRCULAR_MOTION_CAMERA.cameraPosition}
      cameraTarget={UNIFORM_CIRCULAR_MOTION_CAMERA.cameraTarget}
      enablePan
      enableRotate
      enableZoom
      fov={43}
      framing="content"
    />
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
    <CameraBounds
      motion={{
        rotation: "y",
        translation: {
          x: { min: -motion.radius, max: motion.radius },
          y: { min: 0.025, max: 0.025 },
          z: { min: -motion.radius, max: motion.radius },
        },
      }}
      objectRef={groupRef}
    >
      <group
        rotation={[0, 0, 0]}
        scale={UNIFORM_CIRCULAR_MOTION_SCENE.carScale}
      >
        <CarModel />
      </group>
    </CameraBounds>
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

function getPointOnCircle(angle: number, radius: number) {
  return {
    angle,
    x: radius * Math.cos(angle),
    z: radius * Math.sin(angle),
  };
}
