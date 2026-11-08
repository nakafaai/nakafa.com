/**
 * The physical materials a science lab is made of. Each reflects the studio
 * environment of `ScienceStage`, so glass and metal read as glass and metal
 * without a texture. Glass and liquid stay transparent surfaces rather than
 * transmissive ones: transmission renders the whole scene a second time on
 * every frame, which a phone cannot spare for an animated lab, while a clear
 * coat over a transparent surface keeps the reflections that sell the glass.
 */

import { DoubleSide } from "three";

/** Clear lab glass: thin, glossy, and tinted only by the color it is given. */
export function GlassMaterial({
  color,
  opacity = 0.24,
}: {
  readonly color: string;
  readonly opacity?: number;
}) {
  return (
    <meshPhysicalMaterial
      clearcoat={1}
      clearcoatRoughness={0.04}
      color={color}
      depthWrite={false}
      ior={1.5}
      metalness={0}
      opacity={opacity}
      roughness={0.05}
      side={DoubleSide}
      transparent
    />
  );
}

/** A liquid in glassware: denser than the glass, with a wet sheen on top. */
export function LiquidMaterial({
  color,
  opacity = 0.66,
}: {
  readonly color: string;
  readonly opacity?: number;
}) {
  return (
    <meshPhysicalMaterial
      clearcoat={0.6}
      clearcoatRoughness={0.1}
      color={color}
      depthWrite={false}
      ior={1.33}
      metalness={0}
      opacity={opacity}
      roughness={0.12}
      transparent
    />
  );
}

/** Brushed metal, as on a balance, a clock case, or an iron nail. */
export function MetalMaterial({
  color,
  roughness = 0.32,
}: {
  readonly color: string;
  readonly roughness?: number;
}) {
  return (
    <meshPhysicalMaterial color={color} metalness={1} roughness={roughness} />
  );
}
