import { HalfShell } from "@repo/design-system/components/contents/biology/cell/parts";
import type { Placement } from "@repo/design-system/components/contents/biology/instances";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { insideBall } from "@repo/design-system/components/contents/biology/virus/capsid";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** Where a pore of the nuclear envelope sits on the back half of a nucleus of `radius`. */
function poreAt(index: number, radius: number): Placement {
  const theta = Math.acos(2 * hashUnit(index, 41) - 1);
  const phi = Math.PI + hashUnit(index, 42) * Math.PI;
  const up = [
    Math.sin(theta) * Math.cos(phi),
    Math.cos(theta),
    Math.sin(theta) * Math.sin(phi),
  ] as const;
  return {
    position: [up[0] * radius, up[1] * radius, up[2] * radius],
    up,
  };
}

/**
 * A nucleus cut open with the cell: an envelope of two membranes, the outer
 * one pierced by ring-shaped pore complexes, dark heterochromatin pressed
 * against the inner membrane, paler euchromatin through the middle, and a
 * dense nucleolus.
 */
export function CutNucleus({
  position,
  radius,
}: {
  readonly position: readonly [number, number, number];
  readonly radius: number;
}) {
  const chromatin = useMemo(() => {
    const grains = Arr.filter(
      insideBall(260, radius * 0.92, 17),
      ([, , z]) => z < -radius * 0.04
    );
    return {
      dense: Arr.map(
        Arr.filter(grains, (point) => Math.hypot(...point) > radius * 0.7),
        (point): Placement => ({ position: point, scale: [1.4, 0.8, 1.2] })
      ),
      loose: Arr.map(
        Arr.filter(grains, (point) => Math.hypot(...point) <= radius * 0.7),
        (point): Placement => ({ position: point })
      ),
    };
  }, [radius]);
  const pores = useMemo(
    () => Arr.map(Arr.range(0, 44), (index) => poreAt(index, radius * 1.005)),
    [radius]
  );
  return (
    <group position={position}>
      <HalfShell
        color={CELL_COLORS.nucleus}
        roughness={0.45}
        scale={[radius, radius, radius]}
        seed={7}
        thickness={0.05}
      />
      <HalfShell
        color={CELL_COLORS.nucleus}
        roughness={0.5}
        scale={[radius * 0.93, radius * 0.93, radius * 0.93]}
        seed={8}
        thickness={0.04}
      />
      <Instances placements={pores}>
        <torusGeometry args={[radius * 0.045, radius * 0.016, 6, 14]} />
        <meshStandardMaterial color={CELL_COLORS.nucleolus} roughness={0.6} />
      </Instances>
      <Instances placements={chromatin.dense}>
        <sphereGeometry args={[radius * 0.05, 8, 6]} />
        <meshStandardMaterial color={CELL_COLORS.chromatin} roughness={0.7} />
      </Instances>
      <Instances placements={chromatin.loose}>
        <sphereGeometry args={[radius * 0.03, 6, 5]} />
        <meshStandardMaterial color={CELL_COLORS.nucleolus} roughness={0.7} />
      </Instances>
      <mesh
        castShadow
        position={[radius * 0.15, radius * 0.12, -radius * 0.35]}
      >
        <sphereGeometry args={[radius * 0.32, 32, 24]} />
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={CELL_COLORS.nucleolus}
          roughness={0.6}
        />
      </mesh>
    </group>
  );
}
