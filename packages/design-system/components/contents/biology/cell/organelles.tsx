import { spotInHalf } from "@repo/design-system/components/contents/biology/cell/anatomy";
import type { Placement } from "@repo/design-system/components/contents/biology/instances";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { Array as Arr } from "effect";

/** Lysosomes: dense vesicles about 0.5 µm across, drawn at `size` per µm. */
export function Lysosomes({
  avoid,
  count,
  size,
}: {
  readonly avoid: readonly Keepout[];
  readonly count: number;
  readonly size: number;
}) {
  return (
    <Instances
      placements={Arr.map(
        clearSpots(count, 91, 0.15, avoid, 0.3 * size),
        (position): Placement => ({ position })
      )}
    >
      <sphereGeometry args={[0.25 * size, 16, 12]} />
      <meshPhysicalMaterial
        clearcoat={0.4}
        color={CELL_COLORS.lysosome}
        roughness={0.5}
      />
    </Instances>
  );
}

/** A ball another organelle must stay out of: its centre and radius, in the same frame as the spots. */
export type Keepout = readonly [number, number, number, number];

/**
 * `count` seeded spots in the back half of a unit ball, skipping any that
 * fall within `clearance` of a keep-out ball, so no organelle overlaps
 * another.
 */
function clearSpots(
  count: number,
  salt: number,
  margin: number,
  avoid: readonly Keepout[],
  clearance: number
) {
  return Arr.take(
    Arr.filter(
      Arr.map(Arr.range(0, count * 4 - 1), (index) =>
        spotInHalf(index, salt, margin)
      ),
      (spot) =>
        Arr.every(
          avoid,
          ([x, y, z, r]) =>
            Math.hypot(spot[0] - x, spot[1] - y, spot[2] - z) > r + clearance
        )
    ),
    count
  );
}

/** Mitochondria: capsules about 1.5 µm long and 0.5 µm wide at `size` per µm. */
export function Mitochondria({
  avoid = [],
  count,
  margin,
  size,
}: {
  readonly avoid?: readonly Keepout[];
  readonly count: number;
  readonly margin: number;
  readonly size: number;
}) {
  return (
    <Instances
      placements={Arr.map(
        clearSpots(count, 11, margin, avoid, 0.8 * size),
        (position, index): Placement => ({
          position,
          rotation: [hashUnit(index, 12) * 3, hashUnit(index, 13) * 3, 0],
          scale: [1, 1, 0.8 + hashUnit(index, 14) * 0.3],
        })
      )}
    >
      <capsuleGeometry args={[0.25 * size, 1 * size, 8, 16]} />
      <meshPhysicalMaterial
        clearcoat={0.5}
        clearcoatRoughness={0.4}
        color={CELL_COLORS.mitochondrion}
        roughness={0.4}
      />
    </Instances>
  );
}

/** Ribosomes: grains 25 nm across, drawn at `size` per µm. */
export function Ribosomes({
  avoid = [],
  count,
  margin,
  size,
}: {
  readonly avoid?: readonly Keepout[];
  readonly count: number;
  readonly margin: number;
  readonly size: number;
}) {
  const radius = Math.max(0.006, 0.0125 * size);
  return (
    <Instances
      placements={Arr.map(
        clearSpots(count, 21, margin, avoid, radius),
        (position): Placement => ({ position })
      )}
    >
      <sphereGeometry args={[radius, 6, 4]} />
      <meshStandardMaterial color={CELL_COLORS.ribosome} roughness={0.8} />
    </Instances>
  );
}
