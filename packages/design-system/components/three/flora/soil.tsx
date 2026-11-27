import {
  growCrumbs,
  moundMesh,
} from "@repo/design-system/components/three/flora/crumb";
import {
  leavesOf,
  solidOf,
} from "@repo/design-system/components/three/flora/solid";
import { surfaceMaps } from "@repo/design-system/components/three/surface/maps";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { useEffect, useMemo } from "react";
import { IcosahedronGeometry, MeshPhysicalMaterial } from "three";

/** One crumb of soil: a lump with no two faces alike, shared by every crumb of a bed. */
function crumbSolid() {
  const lump = new IcosahedronGeometry(0.5, 1);
  const places = lump.getAttribute("position");
  for (let index = 0; index < places.count; index += 1) {
    const x = places.getX(index);
    const y = places.getY(index);
    const z = places.getZ(index);
    const swell =
      1 + 0.28 * Math.sin(x * 9.1 + y * 5.3) * Math.cos(z * 7.7 + x * 3.1);
    places.setXYZ(index, x * swell, y * swell * 0.72, z * swell);
  }
  lump.computeVertexNormals();
  return lump;
}

/**
 * A bed of soil as it lies in a pot or a field: a heaped, lumpy surface with
 * loose crumbs of every size on it and a scatter of pale grit, darker and
 * glistening where it is `wet`. The crumbs are instances of one lump.
 *
 * @param radius - How far the bed reaches from its middle
 * @param heap - How high it is heaped at the middle
 * @param count - How many loose crumbs lie on it
 * @param seed - Which bed this is
 * @param wet - How moist the soil is, from 0 (dry) to 1 (just watered)
 */
export function Soil({
  count = 420,
  heap,
  radius,
  seed = 1,
  wet = 0.6,
}: {
  readonly count?: number;
  readonly heap: number;
  readonly radius: number;
  readonly seed?: number;
  readonly wet?: number;
}) {
  const built = useMemo(() => {
    const maps = surfaceMaps("stone");
    const lump = crumbSolid();
    const earth = new MeshPhysicalMaterial({
      clearcoat: wet * 0.25,
      clearcoatRoughness: 0.5,
      map: maps.tone,
      normalMap: maps.normal,
      roughness: 1 - wet * 0.25,
    });
    const soil = { count, heap, radius, seed };
    return {
      crumbs: leavesOf({
        blade: lump,
        deep: FLORA_COLORS.crumbDark,
        leaves: growCrumbs(soil),
        material: earth,
        sun: wet > 0.5 ? FLORA_COLORS.soilWet : FLORA_COLORS.crumbLight,
      }),
      earth,
      grit: leavesOf({
        blade: lump,
        deep: FLORA_COLORS.perlite,
        leaves: growCrumbs({
          count: Math.round(count / 14),
          heap,
          radius,
          seed: seed + 9,
        }),
        material: earth,
        sun: FLORA_COLORS.crumbLight,
      }),
      lump,
      mound: solidOf(moundMesh(soil)),
    };
  }, [count, heap, radius, seed, wet]);

  useEffect(
    () => () => {
      built.crumbs.dispose();
      built.grit.dispose();
      built.earth.dispose();
      built.lump.dispose();
      built.mound.dispose();
    },
    [built]
  );

  return (
    <group>
      <mesh geometry={built.mound} receiveShadow>
        <SurfaceMaterial
          bump={1}
          color={wet > 0.5 ? FLORA_COLORS.soilWet : FLORA_COLORS.soilDry}
          repeat={[4, 4]}
          roughness={1 - wet * 0.2}
          surface="stone"
        />
      </mesh>
      <primitive object={built.crumbs} />
      <primitive object={built.grit} />
    </group>
  );
}
