import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import type { GroundSchema } from "@repo/design-system/components/three/stage/grain";
import { paintGround } from "@repo/design-system/components/three/stage/grain";
import { useEffect, useMemo } from "react";
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
} from "three";

/** How far the ground spreads from the lab's middle, in reaches: as far as the haze hides it. */
export const GROUND_REACHES = 12;

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

  return (
    <CameraBounds exclude>
      <mesh
        position={[0, floor, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        userData={{ treatAsOpaque: true }}
      >
        <circleGeometry args={[GROUND_REACHES * reach, 96]} />
        <meshStandardMaterial
          aoMap={patches}
          aoMapIntensity={1}
          bumpMap={bump}
          bumpScale={0.35}
          map={map}
          metalness={0}
          roughness={0.94}
        />
      </mesh>
    </CameraBounds>
  );
}
