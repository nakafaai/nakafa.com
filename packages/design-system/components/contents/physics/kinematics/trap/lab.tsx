import { useFrame } from "@react-three/fiber";
import { RoadsideCamera } from "@repo/design-system/components/contents/physics/kinematics/follow";
import { MotionPlot } from "@repo/design-system/components/contents/physics/kinematics/plot";
import {
  DistancePosts,
  ROAD,
  Road,
} from "@repo/design-system/components/contents/physics/kinematics/road";
import type { SedanRig } from "@repo/design-system/components/contents/physics/kinematics/sedan";
import {
  SEDAN,
  Sedan,
} from "@repo/design-system/components/contents/physics/kinematics/sedan";
import { curvePoints } from "@repo/design-system/components/contents/physics/kinematics/ticks";
import type { GateRig } from "@repo/design-system/components/contents/physics/kinematics/trap/beam";
import { LightGate } from "@repo/design-system/components/contents/physics/kinematics/trap/beam";
import { SpeedBoard } from "@repo/design-system/components/contents/physics/kinematics/trap/board";
import type { TrapGap } from "@repo/design-system/components/contents/physics/kinematics/trap/gates";
import {
  TRAP_ACCELERATION,
  TRAP_CENTRE,
  TrapGapSchema,
  trapArrival,
  trapPosition,
  trapReading,
} from "@repo/design-system/components/contents/physics/kinematics/trap/gates";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
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
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useRef, useState } from "react";

/** How far the track runs, in metres: past the widest trap. */
const TRACK = 80;

/** How long the run lasts: until the car reaches the end of the track. */
const DURATION = trapArrival(TRACK);

/** Simulated seconds per wall second: the run is slowed so the beams can be seen breaking. */
const PLAY_RATE = 0.6;

/** How long the finished run rests before it starts again, in wall seconds. */
const HOLD_SECONDS = 1.5;

/** How far the car's nose is ahead of its origin between the axles, in metres. */
const NOSE = SEDAN.length / 2 + (SEDAN.frontAxle + SEDAN.rearAxle) / 2;

/** The moment a paused card shows for a gap: the car's tail has just cleared the second gate. */
function stillTime(gap: TrapGap) {
  return trapArrival(TRAP_CENTRE + gap / 2 + SEDAN.length + 1.5);
}

interface SpeedTrapInstantSpeedLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    averageSpeed: ReactNode;
    chooseGap: string;
    elapsed: ReactNode;
    gap: ReactNode;
    instantSpeed: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

/**
 * A speed trap of two light gates around one spot of a test road, which a
 * car crosses while speeding up from rest at 4 m/s². The trap reads the
 * average speed across its gap; shrinking the gap brings that reading to
 * the car's instantaneous speed at the centre, 20 m/s, and on the graph the
 * secant turns into the tangent.
 */
export function SpeedTrapInstantSpeedLab({
  description,
  labels,
  title,
}: SpeedTrapInstantSpeedLabProps) {
  const [gap, setGap] = useState<TrapGap>(40);
  const measure = useQuantity();
  const reading = trapReading(gap);
  const isGap = Schema.is(TrapGapSchema);
  const centre = trapArrival(TRAP_CENTRE);

  return (
    <VisualCard
      onReset={() => {
        setGap(40);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseGap}
          gridColumns="4"
          onValueChange={(value) => {
            const next = Number(value);
            if (isGap(next)) {
              setGap(next);
            }
          }}
          type="single"
          value={String(gap)}
          variant="outline"
        >
          {Arr.map(TrapGapSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={String(option)}>
              <InlineMath math={`d=${option}\\text{ m}`} />
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
          floor={-0.015}
          frameloop="always"
          ground="grass"
          reach={gap + 20}
          setting="field"
        >
          <Suspense fallback={null}>
            <RoadsideCamera
              from={TRAP_CENTRE - gap / 2}
              resetKey={gap}
              to={TRAP_CENTRE + gap / 2}
            />
            <TrapScene gap={gap} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <MotionPlot
          curve={{
            color: PLOT_COLORS.pink,
            label: <InlineMath math="x(t)" />,
            points: curvePoints(0, DURATION, 48, trapPosition),
          }}
          end={{
            color: PLOT_COLORS.amber,
            label: <InlineMath math="t_2" />,
            point: { x: reading.leave, y: TRAP_CENTRE + gap / 2 },
          }}
          secant={<InlineMath math="\bar{v}" />}
          start={{
            color: PLOT_COLORS.amber,
            label: <InlineMath math="t_1" />,
            point: { x: reading.enter, y: TRAP_CENTRE - gap / 2 },
          }}
          tangent={{
            label: <InlineMath math="v" />,
            points: [
              { x: centre - TRAP_CENTRE / reading.instant, y: 0 },
              {
                x: DURATION,
                y: TRAP_CENTRE + reading.instant * (DURATION - centre),
              },
            ],
          }}
          x={{ caption: "t\\ (\\text{s})", domain: [0, Math.ceil(DURATION)] }}
          y={{ caption: "x\\ (\\text{m})", domain: [0, TRACK] }}
        />
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.gap}
            value={<InlineMath math={measure(gap, "\\text{ m}", 0)} />}
          />
          <VisualFactTabular
            label={labels.elapsed}
            value={
              <InlineMath math={measure(reading.elapsed, "\\text{ s}", 3)} />
            }
          />
          <VisualFactTabular
            label={labels.averageSpeed}
            value={
              <InlineMath math={measure(reading.average, "\\text{ m/s}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.instantSpeed}
            value={
              <InlineMath
                math={measure(
                  TRAP_ACCELERATION * trapArrival(TRAP_CENTRE),
                  "\\text{ m/s}",
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

/**
 * The test road, the two gates of the trap with the stretch they time
 * painted between them, the car that speeds up through them, and the board
 * that shows what the trap read once the car has left it.
 */
function TrapScene({ gap }: { readonly gap: TrapGap }) {
  const playing = useVisualScene((card) => card.playing, false);
  const measure = useQuantity();
  const car = useRef<SedanRig>(null);
  const enter = useRef<GateRig>(null);
  const leave = useRef<GateRig>(null);
  const run = useRef({ gap, lit: true, time: stillTime(gap) });
  const [lit, setLit] = useState(true);
  const reading = trapReading(gap);
  const from = TRAP_CENTRE - gap / 2;
  const to = TRAP_CENTRE + gap / 2;

  useVisualStop(() => {
    run.current.time = 0;
  });

  useFrame((_, delta) => {
    const state = run.current;
    if (state.gap !== gap) {
      state.gap = gap;
      state.time = playing ? 0 : stillTime(gap);
    }
    if (playing) {
      const next = state.time + simulationStep(delta) * PLAY_RATE;
      state.time = next > DURATION + HOLD_SECONDS * PLAY_RATE ? 0 : next;
    }
    const front = trapPosition(Math.min(state.time, DURATION));
    const tail = front - SEDAN.length;
    car.current?.place(front - NOSE, false);
    enter.current?.trip(front >= from && tail <= from);
    leave.current?.trip(front >= to && tail <= to);
    if (state.lit !== front >= to) {
      state.lit = front >= to;
      setLit(state.lit);
    }
  });

  return (
    <>
      <Road from={-60} surface="dry" to={TRACK + 60} />
      <DistancePosts
        posts={Arr.filter(
          Arr.map(Arr.range(1, TRACK / 10), (index) => index * 10),
          (post) => post < to
        )}
      />
      <mesh
        position={[TRAP_CENTRE, 0.008, ROAD.lane]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[gap, 3.1]} />
        <meshBasicMaterial
          color={PLOT_COLORS.amber}
          depthWrite={false}
          opacity={0.32}
          transparent
        />
      </mesh>
      <ThreeLabel
        color={PLOT_COLORS.amber}
        fontSize="compact"
        outlineColor={getColor("SLATE", 50)}
        outlineWidth={0.05}
        position={[TRAP_CENTRE, 0.3, 1.4]}
      >
        <InlineMath math={`d=${measure(gap, "\\text{ m}", 0)}`} />
      </ThreeLabel>
      <LightGate at={from} ref={enter} />
      <LightGate at={to} ref={leave} />
      <SpeedBoard at={to + 2.5} lit={lit}>
        <span className="flex flex-col items-center gap-1">
          <InlineMath
            math={`\\Delta t=${measure(reading.elapsed, "\\text{ s}", 3)}`}
          />
          <InlineMath
            math={`\\bar{v}=${measure(reading.average, "\\text{ m/s}", 2)}`}
          />
        </span>
      </SpeedBoard>
      <group position={[0, 0, ROAD.lane]}>
        <Sedan color={PLOT_COLORS.pink} ref={car} />
      </group>
    </>
  );
}
