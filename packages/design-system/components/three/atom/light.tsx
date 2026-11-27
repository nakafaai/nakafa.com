import { paintGlow } from "@repo/design-system/components/three/atom/glow";
import { useMemo } from "react";
import { DataTexture, LinearFilter } from "three";

/** The side of the glow tile, in pixels. */
const TILE = 64;

/** The one glow texture every atom shares, painted the first time one asks. */
const SHARED: { texture: DataTexture | undefined } = { texture: undefined };

/**
 * The soft light of a glowing point as a texture, painted once and shared by
 * every atom on the page, so it is never disposed by a caller.
 */
export function useGlow() {
  return useMemo(() => {
    if (SHARED.texture !== undefined) {
      return SHARED.texture;
    }
    const texture = new DataTexture(paintGlow(TILE), TILE, TILE);
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    SHARED.texture = texture;
    return texture;
  }, []);
}
