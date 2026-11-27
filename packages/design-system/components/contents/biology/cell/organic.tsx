import { lumpAt } from "@repo/design-system/components/contents/biology/cell/lump";
import { facetsOf } from "@repo/design-system/components/three/molecule/ball";
import { useStage } from "@repo/design-system/components/three/stage/context";
import type { Surface } from "@repo/design-system/components/three/surface/detail";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { useEffect, useMemo } from "react";
import { SphereGeometry } from "three";

/**
 * The geometry of an organic lump of radius one: a sphere whose surface
 * swells and dips as `lumpAt` says, stretched by `stretch` along x, y and z
 * before it is lumped, at the detail the stage's tier affords. A lump drawn
 * small and many times over takes a `detail` under one, a share of that. The
 * lump owns the geometry and frees it.
 */
export function useLump(
  seed: number,
  depth: number,
  stretch: readonly [number, number, number] = [1, 1, 1],
  detail = 1
) {
  const { tier } = useStage();
  const [x, y, z] = stretch;
  const geometry = useMemo(() => {
    const facets = facetsOf(tier);
    const sphere = new SphereGeometry(
      1,
      Math.max(8, Math.round(facets.sides * 2 * detail)),
      Math.max(6, Math.round(facets.rings * 2 * detail))
    );
    const place = sphere.getAttribute("position");
    for (let index = 0; index < place.count; index += 1) {
      const px = place.getX(index);
      const py = place.getY(index);
      const pz = place.getZ(index);
      const size = lumpAt(px, py, pz, seed, depth);
      place.setXYZ(index, px * size * x, py * size * y, pz * size * z);
    }
    sphere.computeVertexNormals();
    return sphere;
  }, [depth, detail, seed, tier, x, y, z]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * One organic body, a protein, an organelle or a cell: never a perfect ball,
 * with the relief and wet sheen of living matter.
 */
export function Lump({
  coat = 0.35,
  color,
  depth = 0.14,
  position = [0, 0, 0],
  radius,
  rotation = [0, 0, 0],
  seed,
  stretch,
  surface = "tissue",
}: {
  readonly coat?: number;
  readonly color: string;
  readonly depth?: number;
  readonly position?: readonly [number, number, number];
  readonly radius: number;
  readonly rotation?: readonly [number, number, number];
  readonly seed: number;
  readonly stretch?: readonly [number, number, number];
  readonly surface?: Surface;
}) {
  const geometry = useLump(seed, depth, stretch);
  return (
    <mesh
      castShadow
      geometry={geometry}
      position={position}
      receiveShadow
      rotation={rotation}
      scale={radius}
    >
      <SurfaceMaterial
        bump={0.5}
        coat={coat}
        color={color}
        repeat={[4, 2]}
        roughness={0.55}
        surface={surface}
      />
    </mesh>
  );
}
