/**
 * The physical materials a science lab is made of. Each reflects the studio
 * environment of `ScienceStage`, so glass and metal read as glass and metal
 * without a texture. Glass and liquid stay transparent surfaces rather than
 * transmissive ones: transmission renders the whole scene a second time on
 * every frame, which a phone cannot spare for an animated lab, while a clear
 * coat over a transparent surface keeps the reflections that sell the glass.
 */

import { useStage } from "@repo/design-system/components/three/stage/context";
import { useEffect, useMemo } from "react";
import { DoubleSide, MeshPhysicalMaterial } from "three";

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

/** The refractive index of borosilicate 3.3 laboratory glass (Schott Duran, n_d). */
const BOROSILICATE_IOR = 1.473;

/**
 * The glass of a vessel whose wall a reader looks through, such as a
 * discharge tube or a flask held up to the eye: on a desktop it transmits
 * and refracts the scene behind it through a wall `thickness` deep, tinted
 * the faint green of thick glass toward its edges, which costs one more
 * render of the scene only while the frame changes. A phone keeps the
 * transparent clear-coated glass every other part of a lab uses.
 */
export function VesselGlassMaterial({
  color,
  thickness,
  tint,
}: {
  readonly color: string;
  readonly thickness: number;
  readonly tint: string;
}) {
  const { tier } = useStage();
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        attenuationColor: tint,
        attenuationDistance: thickness * 40,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        color,
        ior: BOROSILICATE_IOR,
        metalness: 0,
        roughness: 0.03,
        side: DoubleSide,
        thickness,
        transmission: 1,
      }),
    [color, thickness, tint]
  );

  useEffect(() => () => material.dispose(), [material]);

  if (tier !== "full") {
    return <GlassMaterial color={color} />;
  }

  return <primitive attach="material" object={material} />;
}
