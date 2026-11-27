import { useFrame } from "@react-three/fiber";
import { RoadsideCamera } from "@repo/design-system/components/contents/physics/kinematics/follow";
import { MotionPlot } from "@repo/design-system/components/contents/physics/kinematics/plot";
import {
  DistancePosts,
  ROAD,
} from "@repo/design-system/components/contents/physics/kinematics/road";
import { MarkerFlag } from "@repo/design-system/components/contents/physics/kinematics/secant/flag";
import type {
  Trip,
  TripGraph,
} from "@repo/design-system/components/contents/physics/kinematics/secant/trip";
import {
  changeOver,
  tripDuration,
  tripIntervals,
  tripReach,
  tripState,
  tripValue,
} from "@repo/design-system/components/contents/physics/kinematics/secant/trip";
import type { SedanRig } from "@repo/design-system/components/contents/physics/kinematics/sedan";
import { Sedan } from "@repo/design-system/components/contents/physics/kinematics/sedan";
import { curvePoints } from "@repo/design-system/components/contents/physics/kinematics/ticks";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Road } from "@repo/design-system/components/three/stage/road";
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useRef, useState } from "react";

/** Simulated seconds per wall second: a 20 s commute plays in 10 s. */
const PLAY_RATE = 2;

/** The spacing of the distance posts for a road of `span` metres, so about ten stand along it. */
function postStep(span: number) {
  if (span > 60) {
    return 10;
  }
  return span > 20 ? 5 : 2;
}

interface CarTripSecantSlopeLabProps {
  description: NonNullable<ReactNode>;
  /** The graph drawn under the road: position, whose secant slope is the average velocity, or velocity, whose secant slope is the average acceleration. */
  graph?: TripGraph;
  labels: {
    /** The change over the interval: displacement on a position graph, change of velocity on a velocity graph. */
    change: ReactNode;
    chooseInterval: string;
    elapsed: ReactNode;
    /** The secant slope: average velocity, or average acceleration. */
    rate: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
  /** The trip the car drives. */
  trip?: Trip;
}

/**
 * A car drives a trip along a straight road while its position-time or
 * velocity-time graph stands below. The learner picks a time interval: flags
 * in the verge mark where the car was at its two ends, and the secant between
 * those two points on the graph has the average velocity, or on a velocity
 * graph the average acceleration, as its slope.
 */
export function CarTripSecantSlopeLab({
  description,
  graph = "position",
  labels,
  title,
  trip = "commute",
}: CarTripSecantSlopeLabProps) {
  const intervals = tripIntervals(trip);
  const [chosen, setChosen] = useState(intervals.length - 1);
  const interval = intervals[chosen] ?? intervals[0];
  const measure = useQuantity();
  const average = changeOver(trip, graph, interval);
  const reach = tripReach(trip, graph);
  const duration = tripDuration(trip);
  const symbols =
    graph === "position"
      ? {
          axis: "x\\ (\\text{m})",
          change: "\\Delta x",
          changeUnit: "\\text{ m}",
          curve: "x(t)",
          rate: "\\bar{v}",
          rateUnit: "\\text{ m/s}",
        }
      : {
          axis: "v\\ (\\text{m/s})",
          change: "\\Delta v",
          changeUnit: "\\text{ m/s}",
          curve: "v(t)",
          rate: "\\bar{a}",
          rateUnit: "\\text{ m/s}^2",
        };

  return (
    <VisualCard
      onReset={() => {
        setChosen(intervals.length - 1);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseInterval}
          gridColumns="4"
          onValueChange={(value) => {
            const index = Number(value);
            if (Number.isInteger(index) && intervals[index]) {
              setChosen(index);
            }
          }}
          type="single"
          value={String(chosen)}
          variant="outline"
        >
          {Arr.map(intervals, ([start, end], index) => (
            <ToggleGroupItem key={`${start}-${end}`} value={String(index)}>
              <InlineMath math={`[${start},\\,${end}]\\text{ s}`} />
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
          reach={40}
          setting="field"
        >
          <Suspense fallback={null}>
            <TripScene interval={interval} trip={trip} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <MotionPlot
          curve={{
            color: PLOT_COLORS.orange,
            label: <InlineMath math={symbols.curve} />,
            points: curvePoints(0, duration, 80, (time) =>
              tripValue(trip, graph, time)
            ),
          }}
          end={{
            color: PLOT_COLORS.violet,
            label: <InlineMath math="t_2" />,
            point: { x: interval[1], y: tripValue(trip, graph, interval[1]) },
          }}
          secant={<InlineMath math={symbols.rate} />}
          start={{
            color: PLOT_COLORS.teal,
            label: <InlineMath math="t_1" />,
            point: { x: interval[0], y: tripValue(trip, graph, interval[0]) },
          }}
          x={{ caption: "t\\ (\\text{s})", domain: [0, duration] }}
          y={{ caption: symbols.axis, domain: [reach.lowest, reach.highest] }}
        />
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.change}
            value={
              <InlineMath
                math={`${symbols.change}=${measure(average.change, symbols.changeUnit, 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.elapsed}
            value={
              <InlineMath
                math={`\\Delta t=${measure(average.elapsed, "\\text{ s}", 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.rate}
            value={
              <InlineMath
                math={`${symbols.rate}=${measure(average.rate, symbols.rateUnit, 2)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The road with its distance posts, the car driving its trip, and a flag at
 * the verge where the car was at each end of the chosen interval. The camera
 * stands on the verge past the end of the road where the trip ends and
 * looks back along all of it, so both flags and the whole trip stay in view.
 */
function TripScene({
  interval,
  trip,
}: {
  readonly interval: readonly [number, number];
  readonly trip: Trip;
}) {
  const car = useRef<SedanRig>(null);
  const measure = useQuantity();
  const duration = tripDuration(trip);
  const { advance, playing } = useTimeline(0, duration / PLAY_RATE);
  const reach = tripReach(trip);
  const step = postStep(Math.max(reach.highest - reach.lowest, 1));
  const [start, end] = interval;

  useFrame((_, delta) => {
    const now = advance(delta) * PLAY_RATE;
    const state = tripState(trip, now);
    car.current?.place(
      state.position,
      state.velocity > 0.05 &&
        tripState(trip, now + 0.05).velocity < state.velocity - 1e-6
    );
  });

  const last = tripState(trip, duration).position;
  const ends =
    last - reach.lowest <= reach.highest - last
      ? ([reach.highest, reach.lowest] as const)
      : ([reach.lowest, reach.highest] as const);

  return (
    <>
      <SimulationTicker running={playing} />
      <RoadsideCamera
        from={ends[0]}
        past={3.5}
        resetKey={`${ends[0]}:${ends[1]}`}
        to={ends[1]}
      />
      <Road
        dash={ROAD.dash}
        spacing={ROAD.spacing}
        width={2 * ROAD.halfWidth}
      />
      <DistancePosts
        posts={Arr.map(
          Arr.range(
            Math.ceil(reach.lowest / step),
            Math.floor(reach.highest / step)
          ),
          (index) => index * step
        )}
      />
      <MarkerFlag
        at={tripState(trip, start).position}
        color={PLOT_COLORS.teal}
        side={-1}
      >
        <InlineMath math={`t_1=${measure(start, "\\text{ s}", 0)}`} />
      </MarkerFlag>
      <MarkerFlag
        at={tripState(trip, end).position}
        color={PLOT_COLORS.violet}
        side={1}
      >
        <InlineMath math={`t_2=${measure(end, "\\text{ s}", 0)}`} />
      </MarkerFlag>
      <group position={[0, 0, ROAD.lane]}>
        <Sedan color={PLOT_COLORS.orange} ref={car} />
      </group>
    </>
  );
}
