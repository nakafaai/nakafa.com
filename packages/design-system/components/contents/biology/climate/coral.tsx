import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { Array as Arr, Schema } from "effect";
import { createContext, use, useEffect, useLayoutEffect, useMemo } from "react";
import type { BufferGeometry } from "three";
import { BufferAttribute, Color, MeshPhysicalMaterial } from "three";

/**
 * How far every coral in the tank has paled, from 0 in full colour to 1 bone
 * white, as the bleaching model reads the heat stress.
 */
export const Paleness = createContext(0);

/** The colonies in the tank, each tinted a little differently by its algae. */
const ColonySchema = Schema.Literals(["brown", "gold", "olive"]);
export type Colony = typeof ColonySchema.Type;

/**
 * The healthy colour of each colony. The zooxanthellae living in coral tissue
 * tint it brown to olive, and no two colonies carry quite the same algae.
 */
const HEALTHY = {
  brown: ECOLOGY_COLORS.coralBrown,
  gold: ECOLOGY_COLORS.coralGold,
  olive: ECOLOGY_COLORS.coralHealthy,
} satisfies Record<Colony, string>;

/**
 * The colour `share` of the way from `from` to `to`, mixed as the eye sees
 * it, in sRGB, so a coral half way to white looks half way there.
 */
function mixed(from: string, to: string, share: number) {
  return new Color(from)
    .convertLinearToSRGB()
    .lerp(new Color(to).convertLinearToSRGB(), share)
    .convertSRGBToLinear();
}

/**
 * The tissue of `colony` at `paleness`: its body colour and the paler colour
 * of its growing tips and ridges, both fading toward bone white as the algae
 * leave and the skeleton shows through.
 */
function tissueOf(colony: Colony, paleness: number) {
  return {
    body: mixed(HEALTHY[colony], ECOLOGY_COLORS.coralBleached, paleness),
    tip: mixed(ECOLOGY_COLORS.coralTip, ECOLOGY_COLORS.coralBleached, paleness),
  };
}

/**
 * Paints a coral's vertices from two of its attributes: `tipness`, from 0 on
 * the body to 1 on a growing tip or a ridge, which lightens it toward the tip
 * colour, and `shade`, the darker tissue down a valley or deep inside the
 * colony, which fades as the pigment goes. The colours are written into the
 * same buffer each time the paleness changes.
 */
export function useTissuePaint(geometry: BufferGeometry, colony: Colony) {
  const paleness = use(Paleness);
  useLayoutEffect(() => {
    const tipness = geometry.getAttribute("tipness");
    const shade = geometry.getAttribute("shade");
    const paint = geometry.hasAttribute("color")
      ? geometry.getAttribute("color")
      : new BufferAttribute(new Float32Array(tipness.count * 3), 3);
    const { body, tip } = tissueOf(colony, paleness);
    const color = new Color();
    for (const index of Arr.range(0, tipness.count - 1)) {
      const dark = shade.getX(index);
      color
        .copy(body)
        .lerp(tip, tipness.getX(index))
        .multiplyScalar(dark + (1 - dark) * paleness * 0.6);
      paint.setXYZ(index, color.r, color.g, color.b);
    }
    paint.needsUpdate = true;
    geometry.setAttribute("color", paint);
  }, [colony, geometry, paleness]);
}

/**
 * Living coral tissue: soft flesh over the skeleton with a wet film of mucus,
 * which catches a faint sheen at its edges, painted by `useTissuePaint`.
 */
export function TissueMaterial() {
  // Sheen is set on the material object itself, which JSX props cannot name.
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.3,
        clearcoatRoughness: 0.42,
        roughness: 0.62,
        sheen: 0.2,
        sheenColor: new Color(ECOLOGY_COLORS.coralTip),
        sheenRoughness: 0.55,
        vertexColors: true,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  return <primitive attach="material" object={material} />;
}

/**
 * The tissue over a colony's corallites, the little cups its polyps sit in:
 * a touch paler than the branch they stand on.
 */
export function CoralliteMaterial({ colony }: { readonly colony: Colony }) {
  const paleness = use(Paleness);
  const color = useMemo(() => {
    const { body, tip } = tissueOf(colony, paleness);
    return body.lerp(tip, 0.15);
  }, [colony, paleness]);
  return (
    <meshPhysicalMaterial
      clearcoat={0.3}
      clearcoatRoughness={0.42}
      color={color}
      roughness={0.6}
    />
  );
}
