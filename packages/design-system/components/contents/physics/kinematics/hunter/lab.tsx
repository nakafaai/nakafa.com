import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { VelocityArrow } from "@repo/design-system/components/contents/physics/kinematics/arrow";
import { SportsBall } from "@repo/design-system/components/contents/physics/kinematics/ball";
import {
  AIM_ANGLE,
  AIM_GRAVITY,
  aimOutcome,
  aimPlaces,
  TARGET,
} from "@repo/design-system/components/contents/physics/kinematics/hunter/aim";
import {
  BENCH_HIGH,
  Bench,
  BORE,
  Launcher,
  MagnetStand,
  TIN,
  Tin,
} from "@repo/design-system/components/contents/physics/kinematics/hunter/rig";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { getColor } from "@repo/design-system/lib/color";
import { TARGET_COLORS } from "@repo/design-system/lib/material/target";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group, InstancedMesh } from "three";
import { Matrix4 } from "three";

/** The time between the ghost images left along each path, in seconds. */
const FLASH = 0.05;

/** The most ghost images one run leaves: the longest run lasts under 0.9 s. */
const GHOSTS = 20;

/** Simulated seconds per wall second. */
const PLAY_RATE = 0.3;

/**
 * Where the tin's axis hangs: the ball's centre reaches the target's
 * distance as its skin touches the tin's wall, so the tin hangs one ball
 * and one tin radius further along.
 */
const TIN_AT = TARGET.distance + BORE + TIN.radius;

/** How far the floor lies below the launch height, in metres. */
const FLOOR = BORE + BENCH_HIGH;

/** How long the speed arrow is for each metre per second, in metres. */
const ARROW = 0.055;

interface FallingTargetAimLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    drop: ReactNode;
    meetTime: ReactNode;
    speed: ReactNode;
    speedName: string;
    viewLabel: string;
  };
  /** The launch speed the card starts at, in m/s, from 5 to 16. */
  speed?: number;
  title: NonNullable<ReactNode>;
}

/**
 * The falling-target demonstration: a launcher aimed straight at a tin 4 m
 * away and 2 m up fires at the instant the tin is let go. Gravity pulls the
 * ball and the tin down by the same amount in the same time, so at every
 * launch speed fast enough to arrive before the tin lands, the ball meets it.
 */
export function FallingTargetAimLab({
  description,
  labels,
  speed: initialSpeed = 10,
  title,
}: FallingTargetAimLabProps) {
  const [speed, setSpeed] = useState(initialSpeed);
  const quantity = useQuantity();
  const outcome = aimOutcome(speed);

  return (
    <VisualCard
      onReset={() => {
        setSpeed(initialSpeed);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <VisualSlider
          heading={labels.speed}
          label={labels.speedName}
          max={16}
          min={5}
          onValueChange={setSpeed}
          readout={<InlineMath math={quantity(speed, "\\text{ m/s}", 0)} />}
          step={1}
          value={speed}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={-FLOOR} reach={3.4} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[2.2, 1.25, 8.4]}
              cameraTarget={[2.45, 0.72, 0]}
              fov={34}
              maxPolarAngle={Math.PI / 2 - 0.05}
            />
            <RangeScene speed={speed} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.meetTime}
            value={
              <InlineMath math={quantity(outcome.meet, "\\text{ s}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.drop}
            value={
              <InlineMath
                math={quantity(
                  Math.min(outcome.drop, TARGET.height),
                  "\\text{ m}",
                  2
                )}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** The straight line the launcher is aimed along, from its muzzle to the hanging tin. */
const AIM_LINE = [
  [0, 0, 0],
  [TARGET.distance, TARGET.height, 0],
] as const;

/** The foot of an arrow in its own frame. */
const ORIGIN = [0, 0, 0] as const;

/**
 * The range on its bench: the launcher on its floor stand at one end, aimed
 * along the dashed line at the tin the electromagnet holds at the other,
 * and the ball and the tin in flight. Ghost images every 0.05 s show both
 * falling the same distance below where they would be without gravity, and
 * the rule beside the tin measures how far it has dropped when the ball
 * arrives.
 */
function RangeScene({ speed }: { readonly speed: number }) {
  const quantity = useQuantity();
  const ball = useRef<Group>(null);
  const tin = useRef<Group>(null);
  const balls = useRef<InstancedMesh>(null);
  const tins = useRef<InstancedMesh>(null);
  const drawn = useRef({ shown: -1, speed: 0 });
  const spot = useMemo(() => new Matrix4(), []);
  const outcome = aimOutcome(speed);
  const end = outcome.hit
    ? outcome.meet
    : Math.sqrt((2 * TARGET.height) / AIM_GRAVITY) + 0.2;
  const { advance, playing } = useTimeline(0, end / PLAY_RATE);
  const drop = Math.min(outcome.drop, TARGET.height);
  const arrow = useMemo(
    () =>
      [
        speed * ARROW * Math.cos(AIM_ANGLE),
        speed * ARROW * Math.sin(AIM_ANGLE),
        0,
      ] as const,
    [speed]
  );
  const rule = useMemo(
    () =>
      [
        [TIN_AT + 0.2, TARGET.height, 0],
        [TIN_AT + 0.3, TARGET.height, 0],
        [TIN_AT + 0.25, TARGET.height, 0],
        [TIN_AT + 0.25, TARGET.height - drop, 0],
        [TIN_AT + 0.2, TARGET.height - drop, 0],
        [TIN_AT + 0.3, TARGET.height - drop, 0],
      ] as const,
    [drop]
  );

  useFrame((_, delta) => {
    const now = advance(delta) * PLAY_RATE;
    const places = aimPlaces(speed, now);
    ball.current?.position.set(places.ball.x, places.ball.y, 0);
    ball.current?.rotation.set(0, 0, -now * 9);
    tin.current?.position.set(TIN_AT, places.can.y - BORE, 0);
    const shown = Math.min(GHOSTS, Math.max(0, Math.ceil(now / FLASH - 1e-6)));
    if (
      balls.current === null ||
      tins.current === null ||
      (shown === drawn.current.shown && speed === drawn.current.speed)
    ) {
      return;
    }
    for (let flash = 0; flash < shown; flash += 1) {
      const ghost = aimPlaces(speed, flash * FLASH);
      balls.current.setMatrixAt(
        flash,
        spot.makeTranslation(ghost.ball.x, ghost.ball.y, 0)
      );
      tins.current.setMatrixAt(
        flash,
        spot.makeTranslation(TIN_AT, ghost.can.y - BORE + TIN.height / 2, 0)
      );
    }
    balls.current.count = shown;
    tins.current.count = shown;
    balls.current.instanceMatrix.needsUpdate = true;
    tins.current.instanceMatrix.needsUpdate = true;
    drawn.current.shown = shown;
    drawn.current.speed = speed;
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <group position={[0.22, -BORE, 0]}>
        <Bench tables={3} />
      </group>
      <Launcher aim={AIM_ANGLE} drop={FLOOR} />
      <group position={[TIN_AT, TARGET.height - BORE + TIN.height, 0]}>
        <MagnetStand drop={TARGET.height + TIN.height} />
      </group>
      <Line
        color={PLOT_COLORS.amber}
        dashed
        dashSize={0.09}
        gapSize={0.07}
        lineWidth={2}
        opacity={0.8}
        points={AIM_LINE}
        transparent
      />
      <instancedMesh
        args={[undefined, undefined, GHOSTS]}
        frustumCulled={false}
        ref={balls}
      >
        <sphereGeometry args={[BORE, 24, 16]} />
        <meshStandardMaterial
          color={PLOT_COLORS.orange}
          depthWrite={false}
          opacity={0.3}
          roughness={0.6}
          transparent
        />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, GHOSTS]}
        frustumCulled={false}
        ref={tins}
      >
        <cylinderGeometry args={[TIN.radius, TIN.radius, TIN.height, 28]} />
        <meshStandardMaterial
          color={TARGET_COLORS.tin}
          depthWrite={false}
          metalness={0.5}
          opacity={0.24}
          roughness={0.4}
          transparent
        />
      </instancedMesh>
      <group ref={ball}>
        <SportsBall color={PLOT_COLORS.orange} radius={BORE} />
      </group>
      <group ref={tin}>
        <Tin />
      </group>
      <group position={[0.1, 0.32, 0]}>
        <VelocityArrow
          color={PLOT_COLORS.teal}
          from={ORIGIN}
          thick={0.022}
          to={arrow}
        />
        <ThreeLabel
          color={PLOT_COLORS.teal}
          fontSize="compact"
          outlineColor={getColor("SLATE", 50)}
          outlineWidth={0.05}
          position={[arrow[0] * 0.5 - 0.1, arrow[1] * 0.5 + 0.26, 0]}
        >
          <InlineMath math={`v_0=${quantity(speed, "\\text{ m/s}", 0)}`} />
        </ThreeLabel>
      </group>
      <Line color={PLOT_COLORS.fuchsia} lineWidth={2.5} points={rule} />
      <ThreeLabel
        color={PLOT_COLORS.fuchsia}
        fontSize="compact"
        outlineColor={getColor("SLATE", 50)}
        outlineWidth={0.05}
        position={[TIN_AT + 0.58, TARGET.height - drop / 2 + 0.1, 0]}
      >
        <InlineMath math={quantity(drop, "\\text{ m}", 2)} />
      </ThreeLabel>
      <ThreeLabel
        color={PLOT_COLORS.amber}
        fontSize="compact"
        outlineColor={getColor("SLATE", 50)}
        outlineWidth={0.05}
        position={[TIN_AT + 0.58, TARGET.height - drop / 2 - 0.12, 0]}
      >
        <InlineMath math={`t=${quantity(outcome.meet, "\\text{ s}", 2)}`} />
      </ThreeLabel>
    </>
  );
}
