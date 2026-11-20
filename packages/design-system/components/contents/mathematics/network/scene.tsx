import { useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  COUNT_STEP,
  countedAt,
  driveAt,
  driveSchedule,
  pathLength,
  pointAlong,
} from "@repo/design-system/components/contents/mathematics/network/drive";
import type {
  Road,
  Town,
} from "@repo/design-system/components/contents/mathematics/network/graph";
import type { Spot } from "@repo/design-system/components/contents/mathematics/network/layout";
import {
  placeOf,
  plateSpots,
} from "@repo/design-system/components/contents/mathematics/network/layout";
import { boardLots } from "@repo/design-system/components/contents/mathematics/network/lots";
import {
  DeliveryVan,
  LengthPlate,
  ModelRoad,
  ModelTown,
  PlanningTable,
  ROAD,
  SIGN_TOP,
} from "@repo/design-system/components/contents/mathematics/network/model";
import type { Route } from "@repo/design-system/components/contents/mathematics/network/paths";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { THREE_DIAGRAM_MAXIMUM_FONT_SIZE } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { NETWORK_COLORS } from "@repo/design-system/lib/material/network";
import { Array as Arr, Option } from "effect";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** What the board shows: each town's degree, or the routes of the trip. */
export type NetworkMode = "degrees" | "route";

/** The unit of the road lengths, which the plates drop on a narrow card to stay clear of each other. */
const KM = "\\text{ km}";

/** How far a road's length plate lies to the side of the road, in metres. */
const PLATE_SIDE = 0.03;

/** The largest label on a narrow card, in pixels, so the signs of two near towns stay apart. */
const NARROW_LABEL = 16;

/**
 * The road network on a planning table: a model board of towns joined by
 * roads. In `degrees` mode each town's sign gives its degree, and the roads
 * of the town in `focus` light up; pointing at a town or tapping it focuses
 * it, and while the card plays the scene visits the towns in turn and tells
 * the card which one it is counting, handing the board back on a pause. In `route` mode each road carries a plate of its length, the trip's
 * start and end carry flags (on a narrow card the plates give the number
 * alone, the footer keeping the unit), and a delivery van drives the routes of `run`
 * while the card plays, lighting the road it follows; at rest it stands at
 * the end of `chosen`. The scene tells the card which route it is driving.
 */
export function NetworkScene({
  chosen,
  degrees,
  end,
  focus,
  lit,
  mode,
  onCount,
  onDrive,
  onFocus,
  onPick,
  plates,
  roads,
  routes,
  run,
  spots,
  start,
  towns,
}: {
  readonly chosen: number;
  readonly degrees: readonly number[];
  readonly end: string;
  readonly focus: string | null;
  readonly lit: number;
  readonly mode: NetworkMode;
  readonly onCount: (town: string | null) => void;
  readonly onDrive: (route: number | null) => void;
  readonly onFocus: (town: string | null) => void;
  readonly onPick: (town: string) => void;
  readonly plates: readonly string[];
  readonly roads: readonly Road[];
  readonly routes: readonly Route[];
  readonly run: readonly number[];
  readonly spots: readonly Spot[];
  readonly start: string;
  readonly towns: readonly Town[];
}) {
  const ink = useLabelInk();
  const size = useThree((state) => state.size);
  const narrow = size.width < 520;
  const labelMax = narrow ? NARROW_LABEL : THREE_DIAGRAM_MAXIMUM_FONT_SIZE;
  const spotOf = useMemo(() => placeOf(towns, spots), [spots, towns]);
  const lots = useMemo(
    () => boardLots(towns, roads, spots),
    [roads, spots, towns]
  );
  const plateAt = useMemo(
    () => plateSpots(towns, roads, spots, PLATE_SIDE),
    [roads, spots, towns]
  );
  const routePoints = useMemo(
    () => Arr.map(routes, (route) => Arr.map(route, spotOf)),
    [routes, spotOf]
  );
  const schedule = useMemo(
    () =>
      driveSchedule(
        Arr.map(run, (index) => pathLength(Arr.getUnsafe(routePoints, index)))
      ),
    [routePoints, run]
  );
  const finish = mode === "route" ? schedule.total : towns.length * COUNT_STEP;
  const { advance, playing } = useTimeline(0, finish);
  const van = useRef<Group>(null);
  const reported = useRef<number | null>(null);
  const counting = useRef<string | null>(null);
  const [hovering, setHovering] = useState(false);
  useCursor(hovering && mode === "degrees");

  // A paused card draws no frame, so the tour hands the board back to the learner here.
  useEffect(() => {
    if (!playing) {
      counting.current = null;
      onCount(null);
    }
  }, [onCount, playing]);

  useFrame((_, delta) => {
    const time = advance(delta);
    const counted =
      mode === "degrees" && playing
        ? Option.getOrNull(countedAt(towns, time))
        : null;
    if (counted !== counting.current) {
      counting.current = counted;
      onCount(counted);
    }
    const idle = mode !== "route" || (!playing && time >= finish);
    const step = driveAt(schedule.drives, time);
    const route = idle ? chosen : Arr.getUnsafe(run, step.index);
    const pose = pointAlong(
      Arr.getUnsafe(routePoints, route),
      idle ? Number.POSITIVE_INFINITY : step.distance
    );
    van.current?.position.set(pose.x, ROAD.top, pose.z);
    van.current?.rotation.set(0, pose.heading, 0);
    const driving = idle ? null : route;
    if (driving !== reported.current) {
      reported.current = driving;
      onDrive(driving);
    }
  });

  const litRoute = Arr.getUnsafe(routes, lit);
  const onRoute = (road: Road) =>
    Arr.some(
      Arr.drop(litRoute, 1),
      (town, at) =>
        (Arr.getUnsafe(litRoute, at) === road.from && town === road.to) ||
        (Arr.getUnsafe(litRoute, at) === road.to && town === road.from)
    );
  const roadPaint = (road: Road) => {
    if (mode === "degrees") {
      return focus !== null && (road.from === focus || road.to === focus)
        ? NETWORK_COLORS.degreeLit
        : null;
    }
    return onRoute(road) ? NETWORK_COLORS.routeLit : null;
  };

  return (
    <group>
      <SimulationTicker running={playing} />
      <NetworkCamera narrow={narrow} />
      <PlanningTable />
      {Arr.map(roads, (road, index) => {
        const from = spotOf(road.from);
        const to = spotOf(road.to);
        const side = Arr.getUnsafe(plateAt, index);
        return (
          <group key={`${road.from}-${road.to}`}>
            <ModelRoad from={from} lit={roadPaint(road)} to={to} />
            {mode === "route" ? (
              <>
                <LengthPlate
                  at={side}
                  turn={Math.atan2(-(to.z - from.z), to.x - from.x)}
                />
                <ThreeLabel
                  color={ink}
                  fontSize="compact"
                  maximumFontSize={labelMax}
                  position={[side.x, 0.004, side.z]}
                >
                  <InlineMath
                    math={`${Arr.getUnsafe(plates, index)}${narrow ? "" : KM}`}
                  />
                </ThreeLabel>
              </>
            ) : null}
          </group>
        );
      })}
      {Arr.map(towns, (town, index) => {
        const here = Arr.getUnsafe(spots, index);
        return (
          <group key={town.id} position={[here.x, 0, here.z]}>
            <ModelTown
              flag={mode === "route" ? tripFlag(town.id, start, end) : null}
              lots={Arr.getUnsafe(lots, index)}
            />
            {/* biome-ignore lint/a11y/noStaticElementInteractions: a three.js mesh takes pointer events, not focus; the toolbar's town buttons are the keyboard and screen reader control for the same town. */}
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                onPick(town.id);
              }}
              onPointerOut={() => {
                setHovering(false);
                onFocus(null);
              }}
              onPointerOver={(event) => {
                event.stopPropagation();
                setHovering(true);
                onFocus(town.id);
              }}
              position={[0, 0.02, 0]}
              visible={false}
            >
              <cylinderGeometry args={[0.055, 0.055, 0.05, 16]} />
            </mesh>
            <ThreeLabel
              anchorY="bottom"
              color={ink}
              fontSize="compact"
              gap={0.004}
              maximumFontSize={labelMax}
              position={[0, SIGN_TOP + 0.004, 0]}
            >
              <span className="flex flex-col items-center leading-tight">
                <span className="font-medium">{town.name}</span>
                {mode === "degrees" ? (
                  <InlineMath math={`d = ${Arr.getUnsafe(degrees, index)}`} />
                ) : null}
              </span>
            </ThreeLabel>
          </group>
        );
      })}
      {mode === "route" ? (
        <group ref={van} scale={1.5}>
          <DeliveryVan />
        </group>
      ) : null}
    </group>
  );
}

/** The flag a town carries on the trip: the start's, the end's, or none. */
function tripFlag(id: string, start: string, end: string) {
  if (id === start) {
    return "start";
  }
  return id === end ? "end" : null;
}

/** Looks down on the board from in front and above, farther back on a narrow card. */
function NetworkCamera({ narrow }: { readonly narrow: boolean }) {
  const distance = narrow ? 1.47 : 1.12;
  const elevation = narrow ? 1.26 : 1.0;
  return (
    <CameraControls
      cameraPosition={[
        0,
        distance * Math.sin(elevation),
        0.02 + distance * Math.cos(elevation),
      ]}
      cameraTarget={[0, 0, 0.02]}
      fov={36}
      maxDistance={distance * 1.6}
      maxPolarAngle={Math.PI / 2 - 0.1}
      minDistance={0.2}
    />
  );
}
