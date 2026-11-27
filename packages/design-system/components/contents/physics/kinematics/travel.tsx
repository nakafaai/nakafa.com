import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import { useRef } from "react";
import type { Object3D } from "three";
import { Vector3 } from "three";

/**
 * A move longer than this in one frame, in the vehicle's own metres, is a
 * lesson putting the vehicle back at its start, not driving, so the wheels do
 * not spin through it.
 */
const JUMP = 3;

/**
 * Measures how far a vehicle really moves along its own heading, its local
 * +x, and hands the running total to `roll` each frame, in the vehicle's own
 * units. Its wheels therefore roll forward, roll back in reverse, and stand
 * still while the lesson pauses, wherever a lab moves it.
 *
 * @param vehicle - The vehicle's group, whose local +x is its heading
 * @param roll - Receives the distance rolled so far
 */
export function useTravel(
  vehicle: RefObject<Object3D | null>,
  roll: (distance: number) => void
) {
  const travel = useRef({
    forward: new Vector3(),
    last: new Vector3(),
    now: new Vector3(),
    rolled: 0,
    started: false,
  });

  useFrame(() => {
    const state = travel.current;
    if (vehicle.current === null) {
      return;
    }
    vehicle.current.getWorldPosition(state.now);
    state.forward.setFromMatrixColumn(vehicle.current.matrixWorld, 0);
    const moved =
      state.now.clone().sub(state.last).dot(state.forward) /
      state.forward.lengthSq();
    state.last.copy(state.now);
    if (!state.started || Math.abs(moved) > JUMP) {
      state.started = true;
      return;
    }
    state.rolled += moved;
    roll(state.rolled);
  });
}
