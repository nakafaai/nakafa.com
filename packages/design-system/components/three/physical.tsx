/**
 * The materials a lab passes a colour of its own to. Glass and liquid are the
 * glass and liquid of `three/matter`, which owns what each one is; a lab
 * that names what a thing is made of uses `Matter` directly.
 */

import { Matter } from "@repo/design-system/components/three/matter/material";

/** Clear lab glass: thin, glossy, and tinted only by the color it is given. */
export function GlassMaterial({
  color,
  ...rest
}: {
  readonly color: string;
  readonly opacity?: number;
}) {
  return <Matter color={color} of="glass" {...rest} />;
}

/** A liquid in glassware: denser than the glass, with a wet sheen on top. */
export function LiquidMaterial({
  color,
  ...rest
}: {
  readonly color: string;
  readonly opacity?: number;
}) {
  return <Matter color={color} of="liquid" {...rest} />;
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

/**
 * The glass of a vessel whose wall a reader looks through, such as a
 * discharge tube or a flask held up to the eye: a wall `thickness` deep that
 * bends the scene behind it where the device can spare the extra render.
 * Thick glass has one edge tint, which `three/matter` owns, so `tint` no
 * longer changes it.
 */
export function VesselGlassMaterial({
  color,
  thickness,
}: {
  readonly color: string;
  readonly thickness: number;
  readonly tint: string;
}) {
  return <Matter color={color} of="glass" thickness={thickness} />;
}
