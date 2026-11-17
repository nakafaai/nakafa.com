import type {
  Electrode,
  Ion,
  Product,
} from "@repo/design-system/components/contents/chemistry/electrolysis/cell";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";

/**
 * The colors of an electrolysis scene, which stands on the dark bench of the
 * lit teaching lab in either theme, so its labels are light ink on a dark
 * halo, which no glass, liquid or bench behind them can swallow. Each ion has
 * its own plot color, which the legend under the scene names, so no reading
 * rests on color alone. The apparatus and the solutions take the colors of
 * their real materials.
 */
export function getElectrolysisColors() {
  return {
    battery: BENCH_COLORS.battery,
    clearLiquid: REAGENT_COLORS.solution,
    electrode: {
      carbon: INSTRUMENT_COLORS.graphite,
      copper: INSTRUMENT_COLORS.copper,
      platinum: INSTRUMENT_COLORS.platinum,
      silver: INSTRUMENT_COLORS.silver,
    } satisfies Record<Electrode, string>,
    electron: PLOT_COLORS.amber,
    glass: BENCH_COLORS.glass,
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
      copper: INSTRUMENT_COLORS.copper,
      hydrogen: REAGENT_COLORS.gasWisp,
      oxygen: REAGENT_COLORS.gasWisp,
      silver: INSTRUMENT_COLORS.silver,
    } satisfies Record<Product, string>,
    halo: ORIGIN_COLOR.DARK,
    text: ORIGIN_COLOR.LIGHT,
    tintedLiquid: REAGENT_COLORS.copperSulfate,
    wire: INSTRUMENT_COLORS.lead,
  };
}

/** The colors an electrolysis scene draws with. */
export type ElectrolysisColors = ReturnType<typeof getElectrolysisColors>;
