import type {
  Point,
  Rung,
} from "@repo/design-system/components/contents/biology/dna/ladder";
import {
  Instances,
  type Placement,
} from "@repo/design-system/components/contents/biology/instances";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";

/**
 * One strand's sugar-phosphate backbone: a thin chain through its points with
 * a phosphate bead at each nucleotide and its deoxyribose sugar set a little
 * inward, toward the base it carries.
 */
export function Backbone({
  color,
  points,
}: {
  readonly color: string;
  readonly points: readonly Point[];
}) {
  const curve = useMemo(
    () =>
      points.length < 2
        ? undefined
        : new CatmullRomCurve3(
            Arr.map(points, ([x, y, z]) => new Vector3(x, y, z))
          ),
    [points]
  );
  if (curve === undefined) {
    return null;
  }
  return (
    <group>
      <mesh castShadow>
        <tubeGeometry args={[curve, points.length * 8, 0.05, 8, false]} />
        <meshPhysicalMaterial clearcoat={0.5} color={color} roughness={0.4} />
      </mesh>
      <Instances
        placements={Arr.map(points, (position): Placement => ({ position }))}
      >
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          clearcoatRoughness={0.3}
          color={color}
          roughness={0.35}
        />
      </Instances>
      <Instances
        placements={Arr.map(
          points,
          ([x, y, z]): Placement => ({
            position: [x, y * 0.8, z * 0.8],
            scale: [1, 0.8, 1],
          })
        )}
      >
        <dodecahedronGeometry args={[0.1, 0]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={CELL_COLORS.deoxyribose}
          roughness={0.45}
        />
      </Instances>
    </group>
  );
}

/** The new backbones the polymerase has laid, one beside each parent. */
export function NewStrands({ ladder }: { readonly ladder: readonly Rung[] }) {
  const copied = Arr.filter(ladder, (rung) => rung.copied);
  return (
    <>
      <Backbone
        color={CELL_COLORS.phosphateNew}
        points={Arr.map(copied, (rung) => rung.newFirst)}
      />
      <Backbone
        color={CELL_COLORS.phosphateNew}
        points={Arr.map(copied, (rung) => rung.newSecond)}
      />
    </>
  );
}
