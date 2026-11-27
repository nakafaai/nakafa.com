import type { Surface } from "@repo/design-system/components/three/surface/detail";
import { paintDetail } from "@repo/design-system/components/three/surface/detail";
import { MutableHashMap, Option } from "effect";
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

/** The side of one detail tile, in pixels: fine enough up close, small enough for a phone. */
const TILE = 256;

/** The tiles painted so far, one set per surface, shared by every lab. */
const PAINTED = MutableHashMap.empty<Surface, ReturnType<typeof paintMaps>>();

/** One image as a texture that repeats across a surface and mipmaps down with distance. */
function tileTexture(pixels: Uint8ClampedArray, color: boolean) {
  const texture = new DataTexture(pixels, TILE, TILE);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  if (color) {
    texture.colorSpace = SRGBColorSpace;
  }
  texture.needsUpdate = true;
  return texture;
}

/** Paints one surface's tone, normal and finish tiles. */
function paintMaps(surface: Surface) {
  const { finish, normal, tone } = paintDetail(surface, TILE);
  return {
    finish: tileTexture(finish, false),
    normal: tileTexture(normal, false),
    tone: tileTexture(tone, true),
  };
}

/**
 * The detail textures of one surface, painted once and then shared: its tone
 * multiplies an object's colour, its normals bend the light over its relief,
 * and its finish varies the shine and shades its pits. Each tile repeats, so
 * a material sets its own repeat on a clone that shares the painted image.
 */
export function surfaceMaps(surface: Surface) {
  const known = MutableHashMap.get(PAINTED, surface);
  if (Option.isSome(known)) {
    return known.value;
  }
  const painted = paintMaps(surface);
  MutableHashMap.set(PAINTED, surface, painted);
  return painted;
}
