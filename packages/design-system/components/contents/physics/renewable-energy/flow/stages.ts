import { Array as Arr, Schema } from "effect";

/**
 * Where 100 J entering five kinds of power plant ends up. Each conversion
 * stage passes on a share of what it gets and hands the rest to the
 * surroundings, so the shares multiply along the chain. The shares are typical
 * round values: a solar cell near 20%, a wind rotor at 45% (below the 59.3%
 * Betz limit), a hydro turbine at 90%, a geothermal heat engine at 12%, a
 * biogas engine at 35%, and a generator or inverter near 95%.
 */

/** The energy entering every plant, in joules. */
export const INPUT_ENERGY = 100;

/** The five plants the chart compares. */
export const PlantSchema = Schema.Literals([
  "solar",
  "wind",
  "hydro",
  "geothermal",
  "biogas",
]);
export type Plant = typeof PlantSchema.Type;

/** The share each stage of a plant passes on, in order from the source. */
export const PLANT_STAGES = {
  biogas: [0.35, 0.95],
  geothermal: [0.12, 0.95],
  hydro: [0.9, 0.95],
  solar: [0.2, 0.96],
  wind: [0.45, 0.95, 0.95],
} as const satisfies Record<Plant, readonly number[]>;

/** Each stage's energy in and out, and what it hands to the surroundings, in joules. */
export function plantFlow(plant: Plant) {
  return Arr.mapAccum(PLANT_STAGES[plant], INPUT_ENERGY, (entering, share) => {
    const kept = entering * share;
    return [kept, { entering, kept, lost: entering - kept }] as const;
  });
}

/** The useful energy that leaves the last stage, in joules. */
export function usefulEnergy(plant: Plant) {
  const [useful] = plantFlow(plant);
  return useful;
}
