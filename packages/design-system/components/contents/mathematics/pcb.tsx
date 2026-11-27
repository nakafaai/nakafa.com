import { RoundedBox } from "@react-three/drei";
import type { Placement } from "@repo/design-system/components/contents/biology/instances";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { CIRCUIT_COLORS } from "@repo/design-system/lib/material/circuit";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";

/**
 * The parts of a printed circuit board at real size, in metres: the FR4
 * laminate under its solder mask, copper traces that show through the mask,
 * gold-plated pads round drilled holes, and the screws that hold the board.
 * A board lies flat with its top face at `top`; everything on it is placed by
 * its x and z on that face.
 */

/** A point on the board's face: across it and toward the reader. */
export type BoardPoint = readonly [x: number, z: number];

/** How thick the copper and its mask stand above the laminate: 70 micrometres, drawn at twice that so it reads. */
const COPPER = 0.000_14;

/** How far a gold pad stands above the mask. */
const PLATING = 0.0002;

/** The solder mask: a cured ink baked on the board, with the soft gloss of stove enamel. */
function Mask({ color }: { readonly color: string }) {
  return <Matter color={color} of="enamel" />;
}

/**
 * The board itself: a glass-epoxy laminate `thickness` thick whose routed
 * edge shows the pale laminate, under a green solder mask, with a plated
 * mounting hole and its screw `inset` in from each corner. `children` stand
 * in the board's frame, with y = 0 on its top face.
 */
export function CircuitBoard({
  children,
  depth,
  inset = 0.008,
  thickness = 0.0016,
  top,
  width,
}: {
  readonly children?: ReactNode;
  readonly depth: number;
  readonly inset?: number;
  readonly thickness?: number;
  readonly top: number;
  readonly width: number;
}) {
  const corners = Arr.flatMap([-1, 1] as const, (side) =>
    Arr.map(
      [-1, 1] as const,
      (end): BoardPoint => [
        side * (width / 2 - inset),
        end * (depth / 2 - inset),
      ]
    )
  );
  return (
    <group position={[0, top, 0]}>
      <RoundedBox
        args={[width, thickness, depth]}
        castShadow
        position={[0, -thickness / 2, 0]}
        radius={thickness * 0.3}
        receiveShadow
        smoothness={4}
      >
        <Matter color={CIRCUIT_COLORS.laminate} of="plastic" />
      </RoundedBox>
      <mesh
        position={[0, 0.000_03, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry
          args={[width - thickness * 0.6, depth - thickness * 0.6]}
        />
        <Mask color={CIRCUIT_COLORS.mask} />
      </mesh>
      <Pads hole={0.0016} radius={0.0034} spots={corners} />
      {Arr.map(corners, ([x, z]) => (
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.0009, 0]}>
            <cylinderGeometry args={[0.0026, 0.0028, 0.0014, 32]} />
            <Matter of="nickel" />
          </mesh>
          <mesh position={[0, 0.001_65, 0]} rotation={[0, Math.PI / 4, 0]}>
            <boxGeometry args={[0.0034, 0.0003, 0.0006]} />
            <Matter color={CIRCUIT_COLORS.drill} of="paint" />
          </mesh>
        </group>
      ))}
      {children}
    </group>
  );
}

/**
 * Copper traces under the mask, each a run of straight segments `width` wide
 * with a round land at every corner and end, as a board house plots them.
 */
export function Traces({
  runs,
  width,
}: {
  readonly runs: readonly (readonly BoardPoint[])[];
  readonly width: number;
}) {
  const { lands, segments } = useMemo(() => {
    const pairs = Arr.flatMap(runs, (run) => Arr.zip(run, Arr.drop(run, 1)));
    return {
      lands: Arr.map(
        Arr.flatten(runs),
        ([x, z]): Placement => ({ position: [x, COPPER / 2, z] })
      ),
      segments: Arr.map(
        pairs,
        ([[fromX, fromZ], [toX, toZ]]): Placement => ({
          position: [(fromX + toX) / 2, COPPER / 2, (fromZ + toZ) / 2],
          rotation: [0, -Math.atan2(toZ - fromZ, toX - fromX), 0],
          scale: [Math.hypot(toX - fromX, toZ - fromZ), 1, 1],
        })
      ),
    };
  }, [runs]);
  return (
    <group>
      <Instances placements={segments}>
        <boxGeometry args={[1, COPPER, width]} />
        <Mask color={CIRCUIT_COLORS.maskOverCopper} />
      </Instances>
      <Instances placements={lands}>
        <cylinderGeometry args={[width / 2, width / 2, COPPER, 20]} />
        <Mask color={CIRCUIT_COLORS.maskOverCopper} />
      </Instances>
    </group>
  );
}

/**
 * Gold-plated pads round drilled holes: an annular ring `radius` across each
 * hole of radius `hole`, as a through-hole part is soldered into.
 */
export function Pads({
  hole,
  radius,
  spots,
}: {
  readonly hole: number;
  readonly radius: number;
  readonly spots: readonly BoardPoint[];
}) {
  const rings = useMemo(
    () =>
      Arr.map(
        spots,
        ([x, z]): Placement => ({
          position: [x, PLATING, z],
          rotation: [-Math.PI / 2, 0, 0],
        })
      ),
    [spots]
  );
  const drills = useMemo(
    () =>
      Arr.map(
        spots,
        ([x, z]): Placement => ({
          position: [x, PLATING + 0.000_05, z],
          rotation: [-Math.PI / 2, 0, 0],
        })
      ),
    [spots]
  );
  return (
    <group>
      <Instances placements={rings}>
        <ringGeometry args={[hole * 0.9, radius, 32]} />
        <Matter of="gold" />
      </Instances>
      <Instances placements={drills}>
        <circleGeometry args={[hole, 24]} />
        <Matter color={CIRCUIT_COLORS.drill} of="paint" />
      </Instances>
    </group>
  );
}
