import { useFrame } from "@react-three/fiber";
import type { Blade } from "@repo/design-system/components/three/flora/blade";
import { bladeMesh } from "@repo/design-system/components/three/flora/blade";
import {
  leavesOf,
  solidOf,
} from "@repo/design-system/components/three/flora/solid";
import { surfaceMaps } from "@repo/design-system/components/three/surface/maps";
import { useEffect, useMemo } from "react";
import { DoubleSide, MeshPhysicalMaterial, Vector2 } from "three";

/** How a blade moves in the wind: its tip most, its stalk not at all, each leaf out of step with its neighbours. */
const SWAY = `
#ifdef USE_INSTANCING
  float floraPhase = dot(instanceMatrix[3].xyz, vec3(3.1, 2.3, 4.7));
  float floraGust = sin(floraWind * 1.7 + floraPhase) * 0.6 + sin(floraWind * 3.9 + floraPhase * 1.7) * 0.4;
  transformed.y += floraGust * floraSway * position.x * position.x;
  transformed.z += floraGust * floraSway * 0.7 * position.x;
#endif`;

/**
 * The veins of a blade, drawn from the same rule its relief is pressed by
 * (the midrib and the side veins that leave it), paler than the tissue
 * between them, and the paler, matter underside of a leaf.
 */
const VEINS = `
  float floraReach = abs(vMapUv.x * 2.0 - 1.0);
  float floraMidrib = exp(-pow(floraReach / (0.055 * (1.15 - vMapUv.y)), 2.0));
  float floraPhase = (vMapUv.y - 0.3 * floraReach - 0.08 * floraReach * floraReach) * floraVeins;
  float floraGap = floraPhase - floor(floraPhase + 0.5);
  float floraSide = exp(-pow(floraGap / 0.075, 2.0)) * pow(1.0 - floraReach, 0.4);
  float floraVein = max(floraMidrib, floraSide * 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.45 + vec3(0.05, 0.07, 0.015), floraVein * 0.6);
  if (!gl_FrontFacing) {
    diffuseColor.rgb = diffuseColor.rgb * vec3(1.18, 1.22, 1.02) + vec3(0.025, 0.035, 0.01);
  }`;

/**
 * The leaves of a plant: one curved, veined blade drawn once for each leaf
 * in `leaves` (the numbers `growHabit` and `growSward` give), tinted from
 * `deep` in the shade to `sun` in the light. Both faces shade, the underside
 * paler as a real leaf's is, and every leaf stirs in the wind while the lab
 * plays, with nothing allocated per frame.
 *
 * @param blade - The shape of one leaf
 * @param leaves - Where every leaf is, as `LEAF_STRIDE` numbers each
 * @param deep - The colour of a shaded leaf
 * @param sun - The colour of a sunlit leaf
 * @param sway - How far a leaf tip moves in the wind, in leaf lengths
 */
export function Foliage({
  blade,
  deep,
  leaves,
  sun,
  sway = 0.1,
}: {
  readonly blade: Blade;
  readonly deep: string;
  readonly leaves: readonly number[];
  readonly sun: string;
  readonly sway?: number;
}) {
  const { material, mesh, wind } = useMemo(() => {
    const maps = surfaceMaps("leaf");
    const uniform = { value: 0 };
    const skin = new MeshPhysicalMaterial({
      aoMap: maps.finish,
      map: maps.tone,
      normalMap: maps.normal,
      normalScale: new Vector2(0.7, 0.7),
      roughness: 0.62,
      roughnessMap: maps.finish,
      sheen: 0.35,
      sheenRoughness: 0.5,
      side: DoubleSide,
    });
    skin.onBeforeCompile = (shader) => {
      shader.uniforms.floraWind = uniform;
      shader.uniforms.floraSway = { value: sway };
      shader.uniforms.floraVeins = { value: blade.veins };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float floraWind;\nuniform float floraSway;"
        )
        .replace("#include <begin_vertex>", `#include <begin_vertex>${SWAY}`);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float floraVeins;"
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>${VEINS}`
        );
    };
    skin.customProgramCacheKey = () => `flora-foliage-${sway}`;
    const geometry = solidOf(bladeMesh(blade));
    return {
      material: skin,
      mesh: leavesOf({ blade: geometry, deep, leaves, material: skin, sun }),
      wind: uniform,
    };
  }, [blade, deep, leaves, sun, sway]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mesh.dispose();
      material.dispose();
    },
    [material, mesh]
  );

  useFrame((_, delta) => {
    wind.value += Math.min(delta, 0.1);
  });

  return <primitive object={mesh} />;
}
