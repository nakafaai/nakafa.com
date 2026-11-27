import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import { Matter } from "@repo/design-system/components/three/matter/material";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";

type Point = readonly [number, number, number];

const UP = new Vector3(0, 1, 0);

/**
 * A force, a field or a current drawn on a rig as a solid arrow from `from`
 * to `to`, in its `color`, with its symbol just beyond the tip, or beyond the
 * tail when `mark` says so, as for a force that presses down on a part. An
 * arrow too short to see is not drawn, so a force of zero shows nothing.
 */
export function Vector({
  children,
  color,
  from,
  mark = "tip",
  to,
}: {
  readonly children: ReactNode;
  readonly color: string;
  readonly from: Point;
  readonly mark?: "tail" | "tip";
  readonly to: Point;
}) {
  const span = useMemo(
    () => new Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]),
    [from, to]
  );
  const length = span.length();
  const turn = useMemo(
    () => new Quaternion().setFromUnitVectors(UP, span.clone().normalize()),
    [span]
  );
  const head = Math.min(0.11, length * 0.5);

  if (length < 0.04) {
    return null;
  }

  return (
    <group>
      <group position={from} quaternion={turn}>
        <mesh position={[0, (length - head) / 2, 0]}>
          <cylinderGeometry args={[0.014, 0.014, length - head, 14]} />
          <Matter color={color} glow={0.22} of="enamel" />
        </mesh>
        <mesh position={[0, length - head / 2, 0]}>
          <coneGeometry args={[0.04, head, 20]} />
          <Matter color={color} glow={0.22} of="enamel" />
        </mesh>
      </group>
      <Tag
        position={
          mark === "tip"
            ? [
                to[0] + (span.x / length) * 0.1,
                to[1] + (span.y / length) * 0.1,
                to[2] + (span.z / length) * 0.1,
              ]
            : [
                from[0] - (span.x / length) * 0.1,
                from[1] - (span.y / length) * 0.1,
                from[2] - (span.z / length) * 0.1,
              ]
        }
      >
        {children}
      </Tag>
    </group>
  );
}
