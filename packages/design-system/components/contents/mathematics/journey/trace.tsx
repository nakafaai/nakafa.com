import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Sheet } from "@repo/design-system/components/contents/mathematics/journey/layout";
import {
  graphSpot,
  INK,
  laneX,
  pointAt,
} from "@repo/design-system/components/contents/mathematics/journey/layout";
import { ROAD_TOP } from "@repo/design-system/components/contents/mathematics/journey/model";
import type { Stage } from "@repo/design-system/components/contents/mathematics/journey/trip";
import {
  arrivalOf,
  facingAt,
  placeAt,
} from "@repo/design-system/components/contents/mathematics/journey/trip";
import {
  Bus,
  Motorbike,
} from "@repo/design-system/components/contents/mathematics/journey/vehicle";
import { JOURNEY_COLORS } from "@repo/design-system/lib/material/journey";
import { Array as Arr, Option } from "effect";
import type { RefObject } from "react";
import { useRef } from "react";
import type { Group } from "three";

/** The smallest a growing line is scaled to, so its matrix never collapses. */
const HAIR = 1e-4;

/** How wide a traveller's line is drawn, in pixels: faint for the whole route, then travelled, then in focus. */
const WIDTHS = { focus: 5, ghost: 2, trace: 3.2 } as const;

/**
 * One traveller on the table: its vehicle on the road, its whole route faint
 * on the graph, the part it has already travelled drawn over it as the clock
 * runs, its corners, and a dot where it is now. A thread runs from the
 * vehicle straight across to the dot, so the vehicle's place on the road and
 * the height of its line on the graph read as one, and a guide drops from the
 * dot to the time axis. The leg in `focus` is drawn bolder. Before it leaves,
 * the vehicle waits where it starts and the graph has no dot for it yet.
 */
export function Traveller({
  color,
  corners,
  focus,
  now,
  sheet,
  stages,
  tops,
  vehicle,
}: {
  readonly color: string;
  readonly corners: boolean;
  readonly focus: Option.Option<number>;
  readonly now: RefObject<number>;
  readonly sheet: Sheet;
  readonly stages: Arr.NonEmptyReadonlyArray<Stage>;
  readonly tops: { readonly km: number; readonly minute: number };
  readonly vehicle: "bus" | "motorbike";
}) {
  const legs = useRef<(Group | null)[]>([]);
  const dot = useRef<Group>(null);
  const drop = useRef<Group>(null);
  const thread = useRef<Group>(null);
  const ride = useRef<Group>(null);
  const spots = [
    graphSpot(
      sheet,
      tops,
      Arr.headNonEmpty(stages).start,
      Arr.headNonEmpty(stages).from
    ),
    ...Arr.map(stages, (stage) => graphSpot(sheet, tops, stage.end, stage.to)),
  ];

  useFrame(() => {
    const minute = now.current;
    const leaves = Arr.headNonEmpty(stages).start;
    const km = placeAt(stages, minute);
    const here = graphSpot(
      sheet,
      tops,
      Math.min(Math.max(minute, leaves), arrivalOf(stages)),
      km
    );
    const facing = facingAt(stages, minute);
    const road = laneX(sheet, facing);
    const left = minute >= leaves;
    Arr.forEach(stages, (stage, index) => {
      const leg = legs.current[index];
      if (!leg) {
        return;
      }
      const share = (minute - stage.start) / (stage.end - stage.start);
      leg.scale.x = Math.min(1, Math.max(HAIR, share));
      leg.visible = share > 0;
    });
    ride.current?.position.set(road, ROAD_TOP, here.z);
    ride.current?.rotation.set(0, -Math.PI * facing, 0);
    dot.current?.position.set(here.x, INK.dot, here.z);
    drop.current?.position.set(here.x, INK.guide, here.z);
    drop.current?.scale.set(1, 1, Math.max(HAIR, sheet.front - here.z));
    thread.current?.position.set(road, INK.thread, here.z);
    thread.current?.scale.set(Math.max(HAIR, here.x - road), 1, 1);
    for (const shown of [dot.current, drop.current, thread.current]) {
      if (shown) {
        shown.visible = left;
      }
    }
  });

  return (
    <group>
      <Line
        color={color}
        lineWidth={WIDTHS.ghost}
        opacity={0.3}
        points={Arr.map(spots, (spot) => pointAt(spot, INK.ghost))}
        transparent
      />
      {Arr.map(stages, (stage, index) => {
        const from = Arr.getUnsafe(spots, index);
        const to = Arr.getUnsafe(spots, index + 1);
        const length = Math.hypot(to.x - from.x, to.z - from.z);
        const bold = Option.contains(focus, index);
        return (
          <group
            key={stage.start}
            position={pointAt(from, INK.trace)}
            ref={(leg) => {
              legs.current[index] = leg;
            }}
            rotation={[0, Math.atan2(-(to.z - from.z), to.x - from.x), 0]}
          >
            <Line
              color={color}
              lineWidth={bold ? WIDTHS.focus : WIDTHS.trace}
              points={[
                [0, 0, 0],
                [length, 0, 0],
              ]}
            />
          </group>
        );
      })}
      {corners
        ? Arr.map(spots, (spot) => (
            <mesh
              key={`${spot.x}-${spot.z}`}
              position={pointAt(spot, INK.dot)}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <circleGeometry args={[0.0045, 24]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          ))
        : null}
      <group ref={drop}>
        <Line
          color={color}
          lineWidth={1.2}
          opacity={0.6}
          points={[
            [0, 0, 0],
            [0, 0, 1],
          ]}
          transparent
        />
      </group>
      <group ref={thread}>
        <Line
          color={JOURNEY_COLORS.ink}
          lineWidth={1.3}
          opacity={0.75}
          points={[
            [0, 0, 0],
            [1, INK.dot - INK.thread, 0],
          ]}
          transparent
        />
      </group>
      <group ref={dot} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <circleGeometry args={[0.0085, 32]} />
          <meshBasicMaterial color={JOURNEY_COLORS.paper} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.0001]}>
          <circleGeometry args={[0.006, 32]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
      <group ref={ride}>{vehicle === "bus" ? <Bus /> : <Motorbike />}</group>
    </group>
  );
}
