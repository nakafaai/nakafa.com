import { useFrame } from "@react-three/fiber";
import {
  laneX,
  roadZ,
} from "@repo/design-system/components/contents/mathematics/journey/layout";
import { ROAD_TOP } from "@repo/design-system/components/contents/mathematics/journey/model";
import type { Stage } from "@repo/design-system/components/contents/mathematics/journey/trip";
import {
  facingAt,
  placeAt,
} from "@repo/design-system/components/contents/mathematics/journey/trip";
import {
  Bus,
  Motorbike,
} from "@repo/design-system/components/contents/mathematics/journey/vehicle";
import type { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useRef } from "react";
import type { Group } from "three";

/** How much larger the vehicles are drawn than the road's scale, so they read from across the table. */
const SCALE = 1.2;

/**
 * One traveller on the road: its vehicle where it is at the clock's minute,
 * in its lane and facing the way it goes. Before it leaves, the vehicle waits
 * where it starts, and once it arrives it stays where it ends.
 */
export function Ride({
  now,
  stages,
  top,
  vehicle,
}: {
  readonly now: RefObject<number>;
  readonly stages: Arr.NonEmptyReadonlyArray<Stage>;
  readonly top: number;
  readonly vehicle: "bus" | "motorbike";
}) {
  const ride = useRef<Group>(null);

  useFrame(() => {
    const facing = facingAt(stages, now.current);
    ride.current?.position.set(
      laneX(facing),
      ROAD_TOP,
      roadZ(top, placeAt(stages, now.current))
    );
    ride.current?.rotation.set(0, -Math.PI * facing, 0);
  });

  return (
    <group ref={ride} scale={SCALE}>
      {vehicle === "bus" ? <Bus /> : <Motorbike />}
    </group>
  );
}
