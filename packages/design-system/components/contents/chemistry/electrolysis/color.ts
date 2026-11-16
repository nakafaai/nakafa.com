import type {
  Electrode,
  Ion,
  Product,
} from "@repo/design-system/components/contents/chemistry/electrolysis/cell";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";

/**
 * The colors of an electrolysis scene, which stands in the lit teaching lab in
 * either theme, so its labels are dark ink on a light halo. Each ion has
 * its own plot color, which the legend under the scene names, so no reading
 * rests on color alone. The apparatus and the solutions take the colors of
 * their real materials.
 */
export function getElectrolysisColors() {
  return {
    battery: MATERIAL.battery,
    clearLiquid: MATERIAL.solution,
    electrode: {
      carbon: MATERIAL.graphite,
      copper: MATERIAL.copper,
      platinum: MATERIAL.platinum,
      silver: MATERIAL.silver,
    } satisfies Record<Electrode, string>,
    electron: PLOT_COLORS.amber,
    glass: MATERIAL.glass,
    ion: {
      chloride: PLOT_COLORS.fuchsia,
      copper: PLOT_COLORS.orange,
      hydrogen: PLOT_COLORS.pink,
      hydroxide: PLOT_COLORS.slate,
      nitrate: PLOT_COLORS.teal,
      silver: getColor("SLATE", 400),
      sodium: PLOT_COLORS.violet,
      sulfate: PLOT_COLORS.amber,
    } satisfies Record<Ion, string>,
    metal: {
      chlorine: PLOT_COLORS.fuchsia,
      copper: MATERIAL.copper,
      hydrogen: MATERIAL.gasWisp,
      oxygen: MATERIAL.gasWisp,
      silver: MATERIAL.silver,
    } satisfies Record<Product, string>,
    halo: ORIGIN_COLOR.LIGHT,
    text: ORIGIN_COLOR.DARK,
    tintedLiquid: MATERIAL.copperSulfate,
    wire: MATERIAL.lead,
  };
}

/** The colors an electrolysis scene draws with. */
export type ElectrolysisColors = ReturnType<typeof getElectrolysisColors>;
