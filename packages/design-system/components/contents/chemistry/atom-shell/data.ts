import { Array as Arr, Result, Schema } from "effect";

export const NEON_ID = "neon";
export const MAGNESIUM_ID = "magnesium";
export const CHLORINE_ID = "chlorine";
export const ARGON_ID = "argon";
const POTASSIUM_ID = "potassium";
export const CALCIUM_ID = "calcium";

export type AtomShellSampleId =
  | typeof NEON_ID
  | typeof MAGNESIUM_ID
  | typeof CHLORINE_ID
  | typeof ARGON_ID
  | typeof POTASSIUM_ID
  | typeof CALCIUM_ID;

export const ATOM_SHELL_SAMPLE_IDS = [
  NEON_ID,
  MAGNESIUM_ID,
  CHLORINE_ID,
  ARGON_ID,
  POTASSIUM_ID,
  CALCIUM_ID,
] satisfies AtomShellSampleId[];

const AtomShellSampleSchema = Schema.Struct({
  atomicNumber: Schema.Finite,
  symbol: Schema.String,
});

export const ATOM_SHELL_SAMPLES = {
  [NEON_ID]: { atomicNumber: 10, symbol: "Ne" },
  [MAGNESIUM_ID]: { atomicNumber: 12, symbol: "Mg" },
  [CHLORINE_ID]: { atomicNumber: 17, symbol: "Cl" },
  [ARGON_ID]: { atomicNumber: 18, symbol: "Ar" },
  [POTASSIUM_ID]: { atomicNumber: 19, symbol: "K" },
  [CALCIUM_ID]: { atomicNumber: 20, symbol: "Ca" },
} satisfies Record<AtomShellSampleId, typeof AtomShellSampleSchema.Type>;

const EarlyElementFillLimitSchema = Schema.Struct({
  fillLimit: Schema.Finite,
  key: Schema.String,
  principalQuantumNumber: Schema.Finite,
});

const EARLY_ELEMENT_FILL_LIMITS = [
  { key: "K", principalQuantumNumber: 1, fillLimit: 2 },
  { key: "L", principalQuantumNumber: 2, fillLimit: 8 },
  { key: "M", principalQuantumNumber: 3, fillLimit: 8 },
  { key: "N", principalQuantumNumber: 4, fillLimit: 2 },
] as const satisfies readonly (typeof EarlyElementFillLimitSchema.Type)[];

/**
 * Narrows ToggleGroup string values to the available atom-shell examples.
 */
export function isAtomShellSampleId(value: string): value is AtomShellSampleId {
  return Arr.some(ATOM_SHELL_SAMPLE_IDS, (sampleId) => sampleId === value);
}

/** Expected failure: the atom-shell examples cover atomic numbers 1 to 20. */
export class EarlyElementShellRangeError extends Schema.TaggedError<EarlyElementShellRangeError>()(
  "EarlyElementShellRangeError",
  {
    message: Schema.String,
  }
) {}

/**
 * Builds the simple shell distribution used for neutral atoms up to calcium.
 */
export function getEarlyElementShellConfiguration(atomicNumber: number) {
  if (
    !Number.isInteger(atomicNumber) ||
    atomicNumber < 1 ||
    atomicNumber > 20
  ) {
    return Result.fail(
      new EarlyElementShellRangeError({
        message: "Early shell configuration supports atomic numbers 1 to 20.",
      })
    );
  }

  let remainingElectrons = atomicNumber;

  return Result.succeed(
    Arr.map(EARLY_ELEMENT_FILL_LIMITS, (shell) => {
      const electronCount = Math.min(remainingElectrons, shell.fillLimit);
      remainingElectrons -= electronCount;

      return {
        ...shell,
        electronCount,
        maximumElectrons: 2 * shell.principalQuantumNumber ** 2,
      };
    })
  );
}
