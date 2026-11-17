import { moleculeParts } from "@repo/design-system/components/contents/biology/climate/gases";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { useMemo } from "react";

/**
 * Each element as a moulded molecular model shows it: the CPK convention of
 * charcoal carbon, red oxygen and white hydrogen, in the satin finish of a
 * real model kit rather than the saturated screen colours.
 */
const ELEMENT_COLORS = {
  carbon: ECOLOGY_COLORS.moleculeCarbon,
  hydrogen: ECOLOGY_COLORS.moleculeHydrogen,
  oxygen: ECOLOGY_COLORS.moleculeOxygen,
} as const;

/**
 * The greenhouse gas molecules at gas level `level`: ball-and-stick models of
 * linear carbon dioxide, bent water and tetrahedral methane, more of them as
 * the level rises, each element one instanced ball and one instanced stick.
 */
export function Molecules({ level }: { readonly level: number }) {
  const parts = useMemo(() => moleculeParts(level), [level]);

  return (
    <group>
      <Atoms color={ELEMENT_COLORS.carbon} parts={parts.carbon} />
      <Atoms color={ELEMENT_COLORS.hydrogen} parts={parts.hydrogen} />
      <Atoms color={ELEMENT_COLORS.oxygen} parts={parts.oxygen} />
    </group>
  );
}

/** The balls and half-sticks of one element, in its colour. */
function Atoms({
  color,
  parts,
}: {
  readonly color: string;
  readonly parts: ReturnType<typeof moleculeParts>["carbon"];
}) {
  return (
    <group>
      <Instances placements={parts.balls}>
        <sphereGeometry args={[1, 28, 18]} />
        <meshPhysicalMaterial
          clearcoat={0.55}
          clearcoatRoughness={0.3}
          color={color}
          roughness={0.42}
        />
      </Instances>
      <Instances placements={parts.sticks}>
        <cylinderGeometry args={[1, 1, 1, 14, 1, true]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          clearcoatRoughness={0.35}
          color={color}
          roughness={0.48}
        />
      </Instances>
    </group>
  );
}
