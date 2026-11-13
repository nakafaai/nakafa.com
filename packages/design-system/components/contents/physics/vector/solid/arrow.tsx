import { useThree } from "@react-three/fiber";
import {
  VectorArrow,
  type VectorArrowHandle,
} from "@repo/design-system/components/contents/physics/solid/arrow";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { useLayoutEffect, useRef } from "react";
import { Vector3 } from "three";

/**
 * A solid vector arrow that stands still until its vector changes: the
 * shared moving arrow, set once from props, and the frame drawn again on
 * demand.
 */
export function FixedArrow({
  color,
  from,
  head = 0.05,
  thickness = 0.008,
  vector,
}: {
  readonly color: string;
  readonly from: CoordinateTuple;
  readonly head?: number;
  readonly thickness?: number;
  readonly vector: CoordinateTuple;
}) {
  const handle = useRef<VectorArrowHandle>(null);
  const invalidate = useThree((state) => state.invalidate);
  const [fx, fy, fz] = from;
  const [vx, vy, vz] = vector;

  useLayoutEffect(() => {
    handle.current?.set(new Vector3(fx, fy, fz), new Vector3(vx, vy, vz));
    invalidate();
  }, [fx, fy, fz, vx, vy, vz, invalidate]);

  return (
    <VectorArrow
      color={color}
      head={head}
      ref={handle}
      thickness={thickness}
    />
  );
}
