import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import type { GroundSchema } from "@repo/design-system/components/three/stage/grain";
import { paintGround } from "@repo/design-system/components/three/stage/grain";
import { useCallback, useEffect, useMemo } from "react";
import type { Material } from "three";
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
} from "three";

/** How far the ground spreads from the lab's middle, in reaches: past the haze and horizon fade. */
export const GROUND_REACHES = 16;

/** Where radial horizon fade begins and completes, in reaches from the scene origin. */
export const HORIZON_FADE_INNER = 2.8;
export const HORIZON_FADE_OUTER = 12.5;

/**
 * Returns a material ref callback that dissolves a horizontal stage surface
 * (terrain, road, pavement, rail, sea, or bench) smoothly to transparent
 * between `innerRadius` and `outerRadius` around the scene origin using a
 * C2-continuous quintic falloff so no hard horizon edge ever appears against
 * the sky or photo backdrop.
 */
export function useHorizonFade(innerRadius: number, outerRadius: number) {
  return useCallback(
    (material: Material | null) => {
      if (material === null) {
        return;
      }
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uHorizonInner = { value: innerRadius };
        shader.uniforms.uHorizonOuter = { value: outerRadius };
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vHorizonWorldPos;"
          )
          .replace(
            "#include <worldpos_vertex>",
            "#include <worldpos_vertex>\nvHorizonWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;"
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nuniform float uHorizonInner;\nuniform float uHorizonOuter;\nvarying vec3 vHorizonWorldPos;"
          )
          .replace(
            "#include <dithering_fragment>",
            `float horizonT = clamp((length(vHorizonWorldPos.xz) - uHorizonInner) / max(0.0001, uHorizonOuter - uHorizonInner), 0.0, 1.0);
float horizonSmooth = 1.0 - horizonT * horizonT * horizonT * (horizonT * (horizonT * 6.0 - 15.0) + 10.0);
gl_FragColor.a *= horizonSmooth;
if (gl_FragColor.a <= 0.002) discard;
#include <dithering_fragment>`
          );
      };
      material.customProgramCacheKey = () =>
        `horizon-fade-${innerRadius.toFixed(2)}-${outerRadius.toFixed(2)}`;
      material.needsUpdate = true;
    },
    [innerRadius, outerRadius]
  );
}

/** How many pixels a side of the painted ground has. */
const GROUND_PIXELS = 256;

/** How wide one tile of painted ground lies, in reaches. */
const TILE_REACHES = 0.22;

/** How many times the broad patches are laid across the whole ground, each way: too few to find a tile in. */
const PATCH_TIMES = 2.3;

/** A painted image as a texture that repeats `times` across the ground. */
export function groundTexture(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  times: readonly [across: number, along: number]
) {
  const texture = new DataTexture(pixels, width, height, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(...times);
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The textures of one ground: its fine colour and relief, repeated across a
 * surface, and its broad patches, laid over the whole surface only a few
 * times, so the eye finds no repeating tile. They are freed with the
 * component that asked for them.
 */
export function useGround(
  kind: typeof GroundSchema.Type,
  times: readonly [across: number, along: number]
) {
  const [across, along] = times;
  const textures = useMemo(() => {
    const { color, patches, relief } = paintGround(kind, GROUND_PIXELS);
    const map = groundTexture(color, GROUND_PIXELS, GROUND_PIXELS, [
      across,
      along,
    ]);
    map.colorSpace = SRGBColorSpace;
    const wide = Math.max(across, along);
    return {
      bump: groundTexture(relief, GROUND_PIXELS, GROUND_PIXELS, [
        across,
        along,
      ]),
      map,
      patches: groundTexture(patches, GROUND_PIXELS, GROUND_PIXELS, [
        (PATCH_TIMES * across) / wide,
        (PATCH_TIMES * along) / wide,
      ]),
    };
  }, [across, along, kind]);

  useEffect(
    () => () => {
      textures.map.dispose();
      textures.bump.dispose();
      textures.patches.dispose();
    },
    [textures]
  );

  return textures;
}

/**
 * The ground a lab stands on, as far as the eye reaches: grass, asphalt,
 * sand, snow, soil or concrete, painted with grain and relief, taking the key
 * light's shadows, and fading into the backdrop's horizon with the haze. It
 * has no edge to see, so nothing stands on a cut slab. The camera leaves it
 * out when it frames the lab.
 */
export function Terrain({ kind }: { readonly kind: typeof GroundSchema.Type }) {
  const { floor = 0, reach } = useStage();
  const tiles = (2 * GROUND_REACHES) / TILE_REACHES;
  const { bump, map, patches } = useGround(kind, [tiles, tiles]);
  const horizonFade = useHorizonFade(
    HORIZON_FADE_INNER * reach,
    HORIZON_FADE_OUTER * reach
  );

  return (
    <CameraBounds exclude>
      <mesh
        position={[0, floor, 0]}
        receiveShadow
        renderOrder={-10}
        rotation={[-Math.PI / 2, 0, 0]}
        userData={{ treatAsOpaque: true }}
      >
        <circleGeometry args={[GROUND_REACHES * reach, 96]} />
        <meshStandardMaterial
          aoMap={patches}
          aoMapIntensity={1}
          bumpMap={bump}
          bumpScale={0.35}
          depthWrite
          map={map}
          metalness={0}
          ref={horizonFade}
          roughness={0.94}
          transparent
        />
      </mesh>
    </CameraBounds>
  );
}
