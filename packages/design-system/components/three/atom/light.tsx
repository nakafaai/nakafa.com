import { paintGlow } from "@repo/design-system/components/three/atom/glow";
import { useMemo } from "react";
import { AdditiveBlending, Color, DataTexture, LinearFilter } from "three";

/** The side of the glow tile, in pixels. */
const TILE = 64;

/** How far past the bloom threshold a spark shines. */
const SHINE = 3.2;

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

/**
 * One glowing point of light of the given width, in the place its parent
 * puts it: a free electron on its way from one atom to another. It always
 * faces the camera and shines past the bloom threshold.
 */
export function Spark({
  color,
  size,
}: {
  readonly color: string;
  readonly size: number;
}) {
  const glow = useGlow();
  const tint = useMemo(() => new Color(color).multiplyScalar(SHINE), [color]);
  return (
    <sprite scale={size}>
      <spriteMaterial
        blending={AdditiveBlending}
        color={tint}
        depthWrite={false}
        map={glow}
        toneMapped={false}
        transparent
      />
    </sprite>
  );
}
