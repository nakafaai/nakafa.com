import type { ReactNode } from "react";

export const HYDROGEN_ID = "hydrogen";
export const HELIUM_ID = "helium";
export const CARBON_ID = "carbon";
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
  {
    atomicNumber: number;
    symbol: string;
  }
>;

export const ELECTRON_CONFIGURATION_SHELLS = [
  { key: "K", patternLimit: 2 },
  { key: "L", patternLimit: 8 },
  { key: "M", patternLimit: 8 },
  { key: "N", patternLimit: 2 },
] satisfies readonly { key: string; patternLimit: number }[];

export interface ElectronConfigurationSampleLabels {
  name: string;
  note: ReactNode;
}

export interface ElectronConfigurationLabLabels {
  atomicNumber: string;
  chooseAtom: string;
  configuration: string;
  electronTotal: string;
  outerShell: string;
  samples: Record<
    ElectronConfigurationSampleId,
    ElectronConfigurationSampleLabels
  >;
}

export interface ElectronConfigurationLabProps {
  description: ReactNode;
  labels: ElectronConfigurationLabLabels;
  title: ReactNode;
}

export type ElectronConfigurationSample =
  (typeof ELECTRON_CONFIGURATION_SAMPLES)[ElectronConfigurationSampleId];

/**
 * Narrows ToggleGroup string values to the available electron examples.
 */
export function isElectronConfigurationSampleId(
  value: string
): value is ElectronConfigurationSampleId {
  return ELECTRON_CONFIGURATION_SAMPLE_IDS.some(
    (sampleId) => sampleId === value
  );
}

/**
 * Builds the simple shell configuration used for the first 20 elements.
 */
export function getSimpleShellConfiguration(atomicNumber: number) {
  if (!Number.isInteger(atomicNumber) || atomicNumber < 1) {
    throw new Error(
      "Simple shell configuration requires a positive integer atomic number."
    );
  }

  let remainingElectrons = atomicNumber;

  const shellConfiguration = ELECTRON_CONFIGURATION_SHELLS.map((shell) => {
    const electronCount = Math.min(remainingElectrons, shell.patternLimit);
    remainingElectrons -= electronCount;

    return {
      ...shell,
      electronCount,
    };
  });

  if (remainingElectrons > 0) {
    throw new Error(
      "Simple shell configuration supports atomic numbers up to 20."
    );
  }

  return shellConfiguration;
}

export type ElectronConfigurationShellConfiguration = ReturnType<
  typeof getSimpleShellConfiguration
>;
