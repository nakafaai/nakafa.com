import { radialSurface } from "@repo/design-system/components/three/instrument/radial";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";

/**
 * A machined, rolled or forged part drawn as its real surface about the x
 * axis, where that surface changes round the axis: a threaded shank, a
 * hexagon head. It owns its
 * geometry, builds it once for a shape, and frees it when the part leaves.
 * Its children are the part's material.
 *
 * @param stations - The places along the axis a ring stands at, in order
 * @param radius - How far the surface stands from the axis at a place along it and an angle around it
 * @param around - How many steps one ring takes around the axis
 * @param faceted - Whether the part has true flats, as a hexagon head has, in place of a smooth skin
 */
export function Machined({
  around = 96,
  children,
  faceted = false,
  radius,
  stations,
}: {
  readonly around?: number;
  readonly children: ReactNode;
  readonly faceted?: boolean;
  readonly radius: (along: number, angle: number) => number;
  readonly stations: readonly number[];
}) {
  const geometry = useMemo(() => {
    const surface = radialSurface(stations, around, radius);
    const smooth = new BufferGeometry();
    smooth.setAttribute("position", new BufferAttribute(surface.positions, 3));
    smooth.setAttribute("uv", new BufferAttribute(surface.coordinates, 2));
    smooth.setIndex(new BufferAttribute(surface.faces, 1));
    if (!faceted) {
      smooth.computeVertexNormals();
      return smooth;
    }
    const flat = smooth.toNonIndexed();
    smooth.dispose();
    flat.computeVertexNormals();
    return flat;
  }, [around, faceted, radius, stations]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh castShadow geometry={geometry} receiveShadow>
      {children}
    </mesh>
  );
}
