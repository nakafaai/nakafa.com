import { RoundedBox } from "@react-three/drei";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";

/** How thick a circuit baseboard is, and so the height its parts stand at. */
export const BOARD_TOP = 0.07;

const FEET = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;

/**
 * The varnished oak baseboard a school circuit is screwed to, on four rubber
 * feet, with its grain running along its length. Its parts are its children
 * and stand on its top face, which is at y = 0 for them.
 */
export function OakBoard({
  children,
  depth,
  width,
}: {
  readonly children?: ReactNode;
  readonly depth: number;
  readonly width: number;
}) {
  return (
    <group>
      {Arr.map(FEET, ([x, z]) => (
        <mesh
          key={`${x}:${z}`}
          position={[x * (width / 2 - 0.12), 0.012, z * (depth / 2 - 0.1)]}
        >
          <cylinderGeometry args={[0.05, 0.055, 0.024, 20]} />
          <Matter of="rubber" />
        </mesh>
      ))}
      <RoundedBox
        args={[width, BOARD_TOP - 0.024, depth]}
        castShadow
        position={[0, 0.024 + (BOARD_TOP - 0.024) / 2, 0]}
        radius={0.012}
        receiveShadow
        smoothness={4}
      >
        <Matter of="oak" />
      </RoundedBox>
      <group position={[0, BOARD_TOP, 0]}>{children}</group>
    </group>
  );
}
