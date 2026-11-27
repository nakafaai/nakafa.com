import type { Surface } from "@repo/design-system/components/three/surface/detail";
import { surfaceMaps } from "@repo/design-system/components/three/surface/maps";
import { useEffect, useMemo } from "react";
import type { Side } from "three";
import { FrontSide } from "three";

/** How strongly a relief of 1 bends the light: the slope its normals are painted at. */
const RELIEF = 1 / 0.6;

/**
 * The detail textures of one surface laid `across` by `along` tiles over a
 * part's texture coordinates: clones that share the painted images, freed
 * when the part goes away.
 *
 * @param surface - What the part is made of
 * @param across - Tiles across the part's texture coordinates
 * @param along - Tiles along the part's texture coordinates
 */
export function useSurfaceMaps(
  surface: Surface,
  across: number,
  along: number
) {
  const maps = useMemo(() => {
    const shared = surfaceMaps(surface);
    const lay = (texture: typeof shared.tone) => {
      const copy = texture.clone();
      copy.repeat.set(across, along);
      return copy;
    };
    return {
      finish: lay(shared.finish),
      normal: lay(shared.normal),
      tone: lay(shared.tone),
    };
  }, [across, along, surface]);

  useEffect(
    () => () => {
      maps.finish.dispose();
      maps.normal.dispose();
      maps.tone.dispose();
    },
    [maps]
  );

  return maps;
}

/**
 * A physically based material with the fine detail of a real surface:
 * painted steel with grime and scuffs, brushed metal, wood grain, a cloth
 * weave, pitted rubber or moulded plastic. The colour is the object's own;
 * the surface's tone, normals and finish vary it across the object, so no
 * part reads as a flat, untextured shape, however close the camera comes.
 * `repeat` is how many tiles cross the part's texture coordinates in each
 * direction, chosen so the detail keeps its real size.
 *
 * @param attach - Where the material attaches, for a mesh with one material per group
 * @param surface - What the part is made of
 * @param color - The part's own colour
 * @param repeat - Tiles across and along the part's texture coordinates
 * @param metalness - 1 for bare metal, 0 for everything painted or dielectric
 * @param roughness - The roughness at the surface's smoothest
 * @param side - Which faces draw: both for cloth and thin sheets seen from either side
 * @param bump - How strongly the relief bends the light
 * @param coat - How much clear lacquer or varnish lies over the surface, from 0 to 1
 */
export function SurfaceMaterial({
  attach = "material",
  bump = 0.6,
  coat = 0,
  color,
  metalness = 0,
  repeat = [1, 1],
  roughness = 1,
  side = FrontSide,
  surface,
}: {
  readonly attach?: string;
  readonly bump?: number;
  readonly coat?: number;
  readonly color: string;
  readonly metalness?: number;
  readonly repeat?: readonly [number, number];
  readonly roughness?: number;
  readonly side?: Side;
  readonly surface: Surface;
}) {
  const maps = useSurfaceMaps(surface, repeat[0], repeat[1]);

  return (
    <meshPhysicalMaterial
      aoMap={maps.finish}
      attach={attach}
      clearcoat={coat}
      clearcoatRoughness={0.14}
      color={color}
      map={maps.tone}
      metalness={metalness}
      normalMap={maps.normal}
      normalScale={[bump * RELIEF, bump * RELIEF]}
      roughness={roughness}
      roughnessMap={maps.finish}
      side={side}
    />
  );
}
