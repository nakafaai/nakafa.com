import type { Surface } from "@repo/design-system/components/three/surface/detail";
import { surfaceMaps } from "@repo/design-system/components/three/surface/maps";
import { useEffect, useMemo } from "react";
import type { Side } from "three";
import { FrontSide } from "three";

/**
 * A physically based material with the fine detail of a real surface:
 * painted steel with grime and scuffs, brushed metal, wood grain, a cloth
 * weave, pitted rubber or moulded plastic. The colour is the object's own;
 * the surface's tone, roughness and relief vary it across the object, so no
 * part reads as a flat, untextured shape. `repeat` is how many tiles cross
 * the part's texture coordinates in each direction, chosen so the detail
 * keeps its real size.
 *
 * @param attach - Where the material attaches, for a mesh with one material per group
 * @param surface - What the part is made of
 * @param color - The part's own colour
 * @param repeat - Tiles across and along the part's texture coordinates
 * @param metalness - 1 for bare metal, 0 for everything painted or dielectric
 * @param roughness - The roughness at the surface's smoothest
 * @param side - Which faces draw: both for cloth and thin sheets seen from either side
 * @param bump - How strongly the relief bends the light
 */
export function SurfaceMaterial({
  attach = "material",
  bump = 0.6,
  color,
  metalness = 0,
  repeat = [1, 1],
  roughness = 1,
  side = FrontSide,
  surface,
}: {
  readonly attach?: string;
  readonly bump?: number;
  readonly color: string;
  readonly metalness?: number;
  readonly repeat?: readonly [number, number];
  readonly roughness?: number;
  readonly side?: Side;
  readonly surface: Surface;
}) {
  const [across, along] = repeat;
  const maps = useMemo(() => {
    const shared = surfaceMaps(surface);
    const clone = (texture: typeof shared.tone) => {
      const copy = texture.clone();
      copy.repeat.set(across, along);
      return copy;
    };
    return {
      bump: clone(shared.bump),
      roughness: clone(shared.roughness),
      tone: clone(shared.tone),
    };
  }, [across, along, surface]);

  useEffect(
    () => () => {
      maps.bump.dispose();
      maps.roughness.dispose();
      maps.tone.dispose();
    },
    [maps]
  );

  return (
    <meshStandardMaterial
      attach={attach}
      bumpMap={maps.bump}
      bumpScale={bump}
      color={color}
      map={maps.tone}
      metalness={metalness}
      roughness={roughness}
      roughnessMap={maps.roughness}
      side={side}
    />
  );
}
