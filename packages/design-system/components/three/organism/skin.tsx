import type { Surface } from "@repo/design-system/components/three/surface/detail";
import { useSurfaceMaps } from "@repo/design-system/components/three/surface/material";
import type { Side } from "three";
import { FrontSide } from "three";

/** How strongly a relief of 1 bends the light: the slope the detail normals are painted at. */
const RELIEF = 1 / 0.6;

/**
 * The skin of a living body: the fine detail of a real surface (hide,
 * scales, wet mucosa, domed cells) laid over the colours the body's own
 * geometry carries, so a dark back, a pale belly, stripes and spots all
 * come from one material. `wet` lays a film of water or mucus over it.
 * `flesh` is the colour of light that has passed through thin living
 * tissue, the way an ear, a fin or a blade of grass glows against the sun,
 * and `glow` is how much of it shows. `clear` is how much of the scene shows
 * through a body of jelly, from 0 to 1.
 *
 * @param surface - What the skin is
 * @param repeat - Detail tiles along and around the body
 * @param tint - A colour over the body's own, for one that is all one tone
 * @param wet - The film of water or mucus over the skin, from 0 to 1
 * @param flesh - The colour of light that has passed through the tissue
 * @param glow - How much light passes through thin tissue, from 0 to 1
 * @param clear - How much shows through the body, from 0 to 1
 * @param bump - How strongly the relief bends the light
 * @param roughness - The roughness at the skin's smoothest
 * @param metalness - The mirror sheen of silver scales
 * @param side - Which faces draw: both for a bell or a membrane seen from inside
 */
export function Skin({
  bump = 0.6,
  clear = 0,
  flesh = "#000000",
  glow = 0,
  metalness = 0,
  repeat,
  roughness = 1,
  side = FrontSide,
  surface,
  tint = "#ffffff",
  wet = 0,
}: {
  readonly bump?: number;
  readonly clear?: number;
  readonly flesh?: string;
  readonly glow?: number;
  readonly metalness?: number;
  readonly repeat: readonly [number, number];
  readonly roughness?: number;
  readonly side?: Side;
  readonly surface: Surface;
  readonly tint?: string;
  readonly wet?: number;
}) {
  const maps = useSurfaceMaps(surface, repeat[0], repeat[1]);

  return (
    <meshPhysicalMaterial
      aoMap={maps.finish}
      clearcoat={wet}
      clearcoatRoughness={0.12}
      color={tint}
      depthWrite={clear === 0}
      emissive={flesh}
      emissiveIntensity={glow * 0.3}
      emissiveMap={maps.tone}
      map={maps.tone}
      metalness={metalness}
      normalMap={maps.normal}
      normalScale={[bump * RELIEF, bump * RELIEF]}
      opacity={1 - clear}
      roughness={roughness}
      roughnessMap={maps.finish}
      sheen={glow}
      sheenColor={flesh}
      sheenRoughness={0.5}
      side={side}
      transparent={clear > 0}
      vertexColors
    />
  );
}
