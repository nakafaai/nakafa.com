import { useFrame, useThree } from "@react-three/fiber";
import { axisOf } from "@repo/design-system/components/contents/mathematics/journey/axis";
import {
  lastMinute,
  startClock,
  tickClock,
} from "@repo/design-system/components/contents/mathematics/journey/clock";
import type { Sheet } from "@repo/design-system/components/contents/mathematics/journey/layout";
import {
  namesWidth,
  sheetOf,
  viewOf,
} from "@repo/design-system/components/contents/mathematics/journey/layout";
import {
  Corners,
  MeetingMark,
  SlopeGuides,
} from "@repo/design-system/components/contents/mathematics/journey/marks";
import { Roadside } from "@repo/design-system/components/contents/mathematics/journey/model";
import { GraphPaper } from "@repo/design-system/components/contents/mathematics/journey/paper";
import type { Units } from "@repo/design-system/components/contents/mathematics/journey/readout";
import { Traveller } from "@repo/design-system/components/contents/mathematics/journey/trace";
import type { Stage } from "@repo/design-system/components/contents/mathematics/journey/trip";
import { farthestOf } from "@repo/design-system/components/contents/mathematics/journey/trip";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { JOURNEY_COLORS } from "@repo/design-system/lib/material/journey";
import { Array as Arr, Option } from "effect";
import { useEffect, useLayoutEffect, useRef } from "react";

/** The camera's field of view, in degrees: narrow, so the graph keeps its squares true. */
const FOV = 30;

/**
 * How high the camera looks down on the table, in radians above it: higher on
 * a narrow card, whose graph runs deeper than wide, so its squares stay square.
 */
const ELEVATION = { narrow: 1.15, wide: 1.0 } as const;

/**
 * The journey on a table: a model road with its stops, a sheet of graph paper
 * beside it, and each traveller on both. The scene keeps the clock: still, it
 * shows the `minute` the lab gives it; while the card plays it runs the clock
 * on from there, tells the lab each whole minute, and hands it the minute it
 * stopped at when the learner pauses.
 */
export function JourneyScene({
  focus,
  meeting,
  minute,
  onMinute,
  second,
  stages,
  stops,
  titles,
  units,
}: {
  readonly focus: Option.Option<number>;
  readonly meeting: Option.Option<{
    readonly distance: number;
    readonly minute: number;
  }>;
  readonly minute: number;
  readonly onMinute: (minute: number) => void;
  readonly second: Option.Option<Arr.NonEmptyReadonlyArray<Stage>>;
  readonly stages: Arr.NonEmptyReadonlyArray<Stage>;
  readonly stops: readonly { readonly at: number; readonly name: string }[];
  readonly titles: { readonly distance: string; readonly time: string };
  readonly units: Units;
}) {
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const playing = useVisualScene((card) => card.playing, false);
  const narrow = size.width < size.height * 1.2;
  const trips = Option.match(second, {
    onNone: () => Arr.of(stages),
    onSome: (other) => Arr.make(stages, other),
  });
  const last = lastMinute(trips);
  const axes = {
    km: axisOf(Math.max(...Arr.map(trips, farthestOf)), narrow ? 6 : 5),
    minute: axisOf(last, narrow ? 5 : 7),
  };
  const tops = { km: axes.km.top, minute: axes.minute.top };
  const sheet = sheetOf(narrow, {
    km: axes.km.top / axes.km.step,
    minute: axes.minute.top / axes.minute.step,
  });
  const now = useRef(minute);
  const clock = useRef(startClock(minute, last));
  const shown = useRef(Math.floor(minute));
  const ran = useRef(false);

  useLayoutEffect(() => {
    if (!playing) {
      now.current = minute;
      invalidate();
    }
  }, [invalidate, minute, playing]);

  // A paused card draws no frame, so the clock hands its minute back to the lab here.
  useEffect(() => {
    if (playing) {
      clock.current = startClock(now.current, last);
      ran.current = true;
      return;
    }
    if (ran.current) {
      ran.current = false;
      onMinute(Math.round(now.current));
    }
  }, [last, onMinute, playing]);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current = tickClock(clock.current, simulationStep(delta), last);
    now.current = clock.current.minute;
    const whole = Math.floor(now.current);
    if (whole !== shown.current) {
      shown.current = whole;
      onMinute(whole);
    }
  }, -1);

  return (
    <group>
      <SimulationTicker running={playing} />
      <JourneyCamera
        elevation={narrow ? ELEVATION.narrow : ELEVATION.wide}
        names={namesWidth(Arr.map(stops, (stop) => stop.name))}
        sheet={sheet}
      />
      <Roadside
        narrow={narrow}
        sheet={sheet}
        stops={stops}
        ticks={axes.km.ticks}
        tops={tops}
      />
      <GraphPaper axes={axes} sheet={sheet} titles={titles} />
      <Corners sheet={sheet} stages={stages} tops={tops} />
      {Option.match(focus, {
        onNone: () => null,
        onSome: (part) => (
          <SlopeGuides
            sheet={sheet}
            stage={Arr.getUnsafe(stages, part)}
            tops={tops}
            units={units}
          />
        ),
      })}
      {Option.match(meeting, {
        onNone: () => null,
        onSome: (met) => (
          <MeetingMark meeting={met} sheet={sheet} tops={tops} />
        ),
      })}
      <Traveller
        color={JOURNEY_COLORS.bus}
        corners
        focus={focus}
        now={now}
        sheet={sheet}
        stages={stages}
        tops={tops}
        vehicle="bus"
      />
      {Option.match(second, {
        onNone: () => null,
        onSome: (other) => (
          <Traveller
            color={JOURNEY_COLORS.bike}
            corners={false}
            focus={Option.none()}
            now={now}
            sheet={sheet}
            stages={other}
            tops={tops}
            vehicle="motorbike"
          />
        ),
      })}
    </group>
  );
}

/**
 * Looks down on the table from in front, high enough that the graph's
 * squares stay square to the eye and far enough back that the road, the stop
 * names and the paper all fit the card. The learner may tilt and zoom, but
 * not swing round, so the graph always faces them and Play never turns it.
 */
function JourneyCamera({
  elevation,
  names,
  sheet,
}: {
  readonly elevation: number;
  readonly names: number;
  readonly sheet: Sheet;
}) {
  const size = useThree((state) => state.size);
  const view = viewOf(
    sheet,
    { aspect: size.width / size.height, fov: FOV, names, width: size.width },
    elevation
  );
  return (
    <CameraControls
      cameraPosition={[
        view.target.x,
        view.distance * Math.sin(elevation),
        view.target.z + view.distance * Math.cos(elevation),
      ]}
      cameraTarget={[view.target.x, 0, view.target.z]}
      fov={FOV}
      maxAzimuthAngle={0}
      maxDistance={view.distance * 1.5}
      maxPolarAngle={1.2}
      minAzimuthAngle={0}
      minDistance={0.25}
    />
  );
}
