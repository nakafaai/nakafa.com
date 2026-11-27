import type { SedanRig } from "@repo/design-system/components/contents/physics/kinematics/sedan";
import {
  SEDAN,
  Sedan,
} from "@repo/design-system/components/contents/physics/kinematics/sedan";
import { useTravel } from "@repo/design-system/components/contents/physics/kinematics/travel";
import { useRef } from "react";
import type { Group } from "three";

/**
 * How long the car is on a lesson's road, in scene units. A lesson's road is
 * drawn a few units wide, not at real size, so the real sedan is scaled down
 * to sit in one of its lanes.
 */
const ROAD_CAR_LENGTH = 2.5;

/**
 * The sedan on a lesson's road: scaled to the road's lane and facing +z, the
 * way a lesson's route starts out. Its wheels turn by the distance it really
 * moves, wherever a lab moves it.
 *
 * @param color - The car's paint, which a lab ties to its legend
 */
export function RoadCar({ color }: { readonly color: string }) {
  const car = useRef<Group>(null);
  const rig = useRef<SedanRig>(null);
  useTravel(car, (distance) => rig.current?.roll(distance));

  return (
    <group
      ref={car}
      rotation={[0, -Math.PI / 2, 0]}
      scale={ROAD_CAR_LENGTH / SEDAN.length}
    >
      <Sedan color={color} ref={rig} />
    </group>
  );
}
