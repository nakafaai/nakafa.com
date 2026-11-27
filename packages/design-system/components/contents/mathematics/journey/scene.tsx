import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { axisOf } from "@repo/design-system/components/contents/mathematics/journey/axis";
import {
  lastMinute,
  startClock,
  tickClock,
} from "@repo/design-system/components/contents/mathematics/journey/clock";
import {
  HALF,
  roadZ,
  treeSpots,
  viewOf,
} from "@repo/design-system/components/contents/mathematics/journey/layout";
import {
  BASE,
  Diorama,
  Roadway,
  VERGE,
} from "@repo/design-system/components/contents/mathematics/journey/model";
import type { Units } from "@repo/design-system/components/contents/mathematics/journey/readout";
import { unitTex } from "@repo/design-system/components/contents/mathematics/journey/readout";
import { Ride } from "@repo/design-system/components/contents/mathematics/journey/ride";
import type { Stage } from "@repo/design-system/components/contents/mathematics/journey/trip";
import { farthestOf } from "@repo/design-system/components/contents/mathematics/journey/trip";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { Array as Arr, Option } from "effect";
import { useEffect, useLayoutEffect, useRef } from "react";

/** The camera's field of view, in degrees: narrow, so the far end of the road is drawn as large as the near one. */
const FOV = 30;

/** How high the camera looks down on the diorama, in radians above the table: higher on a narrow card. */
const ELEVATION = { narrow: 0.95, wide: 0.72 } as const;

/** How far the learner may swing the camera round the diorama to either side, in radians. */
const SWING = 0.9;

/**
 * The journey as a road diorama on a table: the model road from left to
 * right with a post at every kilometre mark, its bus stops and trees behind
 * it, and each traveller's vehicle on it. The scene keeps the clock: still,
 * it shows the `minute` the lab gives it; while the card plays it runs the
 * clock on from there, tells the lab each whole minute, and hands it the
 * minute it stopped at when the learner pauses.
 */
export function JourneyScene({
  minute,
  onMinute,
  second,
  stages,
  stops,
  units,
}: {
  readonly minute: number;
  readonly onMinute: (minute: number) => void;
  readonly second: Option.Option<Arr.NonEmptyReadonlyArray<Stage>>;
  readonly stages: Arr.NonEmptyReadonlyArray<Stage>;
  readonly stops: readonly { readonly at: number; readonly name: string }[];
  readonly units: Units;
}) {
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const quantity = useQuantity();
  const narrow = size.width < size.height * 1.2;
  const trips = Option.match(second, {
    onNone: () => Arr.of(stages),
    onSome: (other) => Arr.make(stages, other),
  });
  const last = lastMinute(trips);
  const axis = axisOf(Math.max(...Arr.map(trips, farthestOf)), narrow ? 4 : 5);
  const stopZ = Arr.map(stops, (stop) => roadZ(axis.top, stop.at));
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
      <JourneyCamera elevation={narrow ? ELEVATION.narrow : ELEVATION.wide} />
      <group rotation={[0, -Math.PI / 2, 0]}>
        <Diorama
          stops={stopZ}
          trees={treeSpots(-HALF + 0.02, HALF - 0.02, stopZ)}
        >
          <Roadway
            marks={Arr.map(axis.ticks, (km) => roadZ(axis.top, km))}
            start={roadZ(axis.top, 0)}
          />
        </Diorama>
        {Arr.map(axis.ticks, (km) => (
          <ThreeLabel
            anchorY="top"
            color={ink}
            fontSize={0.03}
            key={km}
            position={[VERGE + 0.012, BASE + 0.002, roadZ(axis.top, km)]}
          >
            <InlineMath math={quantity(km, unitTex(units.distance), 1)} />
          </ThreeLabel>
        ))}
        {Arr.map(stops, (stop) => (
          <ThreeLabel
            anchorY="bottom"
            color={ink}
            fontSize={0.032}
            key={stop.name}
            position={[-VERGE, BASE + 0.036, roadZ(axis.top, stop.at)]}
          >
            {stop.name}
          </ThreeLabel>
        ))}
        <Ride now={now} stages={stages} top={axis.top} vehicle="bus" />
        {Option.match(second, {
          onNone: () => null,
          onSome: (other) => (
            <Ride now={now} stages={other} top={axis.top} vehicle="motorbike" />
          ),
        })}
      </group>
    </group>
  );
}

/**
 * Looks down on the diorama from in front, far enough back that the whole
 * road fits the card. The learner may tilt, zoom and swing a little to
 * either side, but never round behind the hills.
 */
function JourneyCamera({ elevation }: { readonly elevation: number }) {
  const size = useThree((state) => state.size);
  const view = viewOf(
    { aspect: size.width / size.height, fov: FOV },
    elevation
  );
  return (
    <CameraControls
      cameraPosition={[
        0,
        view.distance * Math.sin(elevation),
        view.target + view.distance * Math.cos(elevation),
      ]}
      cameraTarget={[0, 0.01, view.target]}
      fov={FOV}
      maxAzimuthAngle={SWING}
      maxDistance={view.distance * 1.5}
      maxPolarAngle={1.35}
      minAzimuthAngle={-SWING}
      minDistance={0.25}
    />
  );
}
