import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Matter } from "@repo/design-system/components/three/matter/material";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";

type Point = readonly [number, number, number];

const UP = new Vector3(0, 1, 0);

/** The smallest and the largest a letter is drawn, in CSS pixels: readable on a phone, and still a caption on a wide card. */
const SMALLEST = 14;
const LARGEST = 32;

/** The radius of the shaft of a force, the radius and the most length of its head, and how far past its tip its letter stands. */
const ARROW = { gap: 0.1, head: 0.11, point: 0.04, shaft: 0.014 } as const;

/** The shortest a force is drawn at all: one of zero shows nothing. */
const SHORTEST = 0.04;

/**
 * A letter or a reading beside a part of a rig, in `color`: `size` tall in
 * the rig's own units, so it keeps its size against the apparatus on a wide
 * card and on a phone, and never smaller than a phone can read.
 *
 * @param children - What it says, as KaTeX so it reads the same in every language
 * @param color - The colour of its ink
 * @param position - Where its middle stands
 * @param size - How tall its text is, in the units of the rig
 */
export function Letter({
  children,
  color,
  position,
  size,
}: {
  readonly children: ReactNode;
  readonly color: string;
  readonly position: Point;
  readonly size: number;
}) {
  return (
    <ThreeLabel
      color={color}
      fontSize={size}
      maximumFontSize={LARGEST}
      minimumFontSize={SMALLEST}
      position={position}
    >
      <span>{children}</span>
    </ThreeLabel>
  );
}

/**
 * A force on a part of a rig, drawn as a solid arrow from `from`, the place
 * it acts, to `to`, in its `color`, with its letter just past the tip.
 *
 * @param children - The letter of the force
 * @param color - The colour of the arrow and its letter
 * @param from - Where the force acts
 * @param size - How tall its letter is, in the units of the rig
 * @param to - Where the arrow ends
 */
export function Force({
  children,
  color,
  from,
  size,
  to,
}: {
  readonly children: ReactNode;
  readonly color: string;
  readonly from: Point;
  readonly size: number;
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
  const head = Math.min(ARROW.head, length * 0.5);
  const past = (length + ARROW.gap + size * 0.4) / Math.max(length, SHORTEST);

  if (length < SHORTEST) {
    return null;
  }

  return (
    <group>
      <group position={from} quaternion={turn}>
        <mesh position={[0, (length - head) / 2, 0]}>
          <cylinderGeometry
            args={[ARROW.shaft, ARROW.shaft, length - head, 14]}
          />
          <Matter color={color} glow={0.45} of="plastic" />
        </mesh>
        <mesh position={[0, length - head / 2, 0]}>
          <coneGeometry args={[ARROW.point, head, 20]} />
          <Matter color={color} glow={0.45} of="plastic" />
        </mesh>
      </group>
      <Letter
        color={color}
        position={[
          from[0] + span.x * past,
          from[1] + span.y * past,
          from[2] + span.z * past,
        ]}
        size={size}
      >
        {children}
      </Letter>
    </group>
  );
}
