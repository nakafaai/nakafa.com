import { Array as Arr, Result, Schema } from "effect";

export const HYDROGEN_ID = "hydrogen";
export const HELIUM_ID = "helium";
const CARBON_ID = "carbon";
export const NEON_ID = "neon";
export const SODIUM_ID = "sodium";
export const MAGNESIUM_ID = "magnesium";
export const CHLORINE_ID = "chlorine";
export const CALCIUM_ID = "calcium";

export type ElectronConfigurationSampleId =
  | typeof HYDROGEN_ID
  | typeof HELIUM_ID
  | typeof CARBON_ID
  | typeof NEON_ID
  | typeof SODIUM_ID
  | typeof MAGNESIUM_ID
  | typeof CHLORINE_ID
  | typeof CALCIUM_ID;

export const ELECTRON_CONFIGURATION_SAMPLE_IDS = [
  HYDROGEN_ID,
  HELIUM_ID,
  CARBON_ID,
  NEON_ID,
  SODIUM_ID,
  MAGNESIUM_ID,
  CHLORINE_ID,
  CALCIUM_ID,
] satisfies ElectronConfigurationSampleId[];

const ElectronConfigurationSampleSchema = Schema.Struct({
  atomicNumber: Schema.Finite,
  symbol: Schema.String,
});

export const ELECTRON_CONFIGURATION_SAMPLES = {
  [HYDROGEN_ID]: { atomicNumber: 1, symbol: "H" },
  [HELIUM_ID]: { atomicNumber: 2, symbol: "He" },
  [CARBON_ID]: { atomicNumber: 6, symbol: "C" },
  [NEON_ID]: { atomicNumber: 10, symbol: "Ne" },
  [SODIUM_ID]: { atomicNumber: 11, symbol: "Na" },
  [MAGNESIUM_ID]: { atomicNumber: 12, symbol: "Mg" },
  [CHLORINE_ID]: { atomicNumber: 17, symbol: "Cl" },
  [CALCIUM_ID]: { atomicNumber: 20, symbol: "Ca" },
} satisfies Record<
  ElectronConfigurationSampleId,
  typeof ElectronConfigurationSampleSchema.Type
>;

const ElectronConfigurationShellSchema = Schema.Struct({
  key: Schema.String,
  patternLimit: Schema.Finite,
});

const ELECTRON_CONFIGURATION_SHELLS = [
  { key: "K", patternLimit: 2 },
  { key: "L", patternLimit: 8 },
  { key: "M", patternLimit: 8 },
  { key: "N", patternLimit: 2 },
] as const satisfies readonly (typeof ElectronConfigurationShellSchema.Type)[];

/**
 * Narrows ToggleGroup string values to the available electron examples.
 */
export function isElectronConfigurationSampleId(
  value: string
): value is ElectronConfigurationSampleId {
  return Arr.some(
    ELECTRON_CONFIGURATION_SAMPLE_IDS,
    (sampleId) => sampleId === value
  );
}

/** Expected failure: the electron-configuration examples cover atomic numbers 1 to 20. */
class SimpleShellConfigurationError extends Schema.TaggedError<SimpleShellConfigurationError>()(
  "SimpleShellConfigurationError",
  {
    message: Schema.String,
    reason: Schema.Literals(["notPositiveInteger", "aboveSupportedRange"]),
  }
) {}

/**
 * Builds the simple shell configuration used for the first 20 elements.
 */
export function getSimpleShellConfiguration(atomicNumber: number) {
  if (!Number.isInteger(atomicNumber) || atomicNumber < 1) {
    return Result.fail(
      new SimpleShellConfigurationError({
        message:
          "Simple shell configuration requires a positive integer atomic number.",
        reason: "notPositiveInteger",
      })
    );
  }

  let remainingElectrons = atomicNumber;

  const shellConfiguration = Arr.map(ELECTRON_CONFIGURATION_SHELLS, (shell) => {
    const electronCount = Math.min(remainingElectrons, shell.patternLimit);
    remainingElectrons -= electronCount;

    return {
      ...shell,
      electronCount,
    };
  });

  if (remainingElectrons > 0) {
    return Result.fail(
      new SimpleShellConfigurationError({
        message: "Simple shell configuration supports atomic numbers up to 20.",
        reason: "aboveSupportedRange",
      })
    );
  }

  return Result.succeed(shellConfiguration);
}
