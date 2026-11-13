/**
 * The energy balance of a 1.6 m² solar panel in the sun on a 30 °C day. Part
 * of the sunlight bounces off the glass, part leaves as electricity, and the
 * rest warms the panel and leaves it as heat. A hotter cell converts a smaller
 * share, so the electricity grows a little slower than the sunlight. The cell
 * temperature follows the common NOCT estimate.
 */

/** The panel's area, in square metres. */
const PANEL_AREA = 1.6;

/** The share of sunlight the cells turn into electricity at 25 °C. */
const RATED_EFFICIENCY = 0.2;

/** How much of that share the cells lose for every kelvin above 25 °C. */
const TEMPERATURE_COEFFICIENT = 0.004;

/** The air temperature around the panel, in degrees Celsius. */
const AIR_TEMPERATURE = 30;

/** The cell temperature in 800 W/m² of sunlight and 20 °C air, from the panel's data sheet, in degrees Celsius. */
const NOMINAL_CELL_TEMPERATURE = 45;

/** The share of sunlight the front glass reflects. */
const REFLECTED_SHARE = 0.04;

/** The sunlight the slider offers, in watts per square metre. */
export const IRRADIANCE = { max: 1000, min: 200, step: 100 } as const;

/** The cells' temperature in `irradiance` watts per square metre, in degrees Celsius. */
export function cellTemperature(irradiance: number) {
  return AIR_TEMPERATURE + ((NOMINAL_CELL_TEMPERATURE - 20) / 800) * irradiance;
}

/** The share of sunlight the warm cells turn into electricity. */
export function cellEfficiency(irradiance: number) {
  return (
    RATED_EFFICIENCY *
    (1 - TEMPERATURE_COEFFICIENT * (cellTemperature(irradiance) - 25))
  );
}

/** Where the sunlight on the panel goes, in watts; the four parts add back to the input. */
export function panelBalance(irradiance: number) {
  const input = irradiance * PANEL_AREA;
  const electric = input * cellEfficiency(irradiance);
  const reflected = input * REFLECTED_SHARE;
  return { electric, heat: input - electric - reflected, input, reflected };
}
