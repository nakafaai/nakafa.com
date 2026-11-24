import { Match, Schema } from "effect";

const NuclideIdSchema = Schema.Literals([
  "deuterium",
  "helium4",
  "carbon12",
  "iron56",
  "uranium235",
]);

export type NuclideId = typeof NuclideIdSchema.Type;

const NuclearProcessSchema = Schema.Literals(["fusion", "fission"]);

export type NuclearProcess = typeof NuclearProcessSchema.Type;

const NuclideSpecSchema = Schema.Struct({
  bindingPerNucleonMev: Schema.Finite,
  massDefectU: Schema.Finite,
  massNumber: Schema.Int,
  protons: Schema.Int,
});

/** Canonical binding energy per nucleon (MeV) and mass defect (u) for each reference nuclide. */
export function nuclideSpec(nuclide: NuclideId): typeof NuclideSpecSchema.Type {
  return Match.value(nuclide).pipe(
    Match.when("deuterium", () => ({
      bindingPerNucleonMev: 1.11,
      massDefectU: 0.0024,
      massNumber: 2,
      protons: 1,
    })),
    Match.when("helium4", () => ({
      bindingPerNucleonMev: 7.07,
      massDefectU: 0.0304,
      massNumber: 4,
      protons: 2,
    })),
    Match.when("carbon12", () => ({
      bindingPerNucleonMev: 7.68,
      massDefectU: 0.0989,
      massNumber: 12,
      protons: 6,
    })),
    Match.when("iron56", () => ({
      bindingPerNucleonMev: 8.79,
      massDefectU: 0.5284,
      massNumber: 56,
      protons: 26,
    })),
    Match.when("uranium235", () => ({
      bindingPerNucleonMev: 7.59,
      massDefectU: 1.9151,
      massNumber: 235,
      protons: 92,
    })),
    Match.exhaustive
  );
}
