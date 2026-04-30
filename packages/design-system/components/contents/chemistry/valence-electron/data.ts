import { getEarlyElementShellConfiguration } from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import type { ReactNode } from "react";

export const HYDROGEN_ID = "hydrogen";
export const HELIUM_ID = "helium";
export const SODIUM_ID = "sodium";
export const MAGNESIUM_ID = "magnesium";
export const ALUMINUM_ID = "aluminum";
export const CHLORINE_ID = "chlorine";
export const ARGON_ID = "argon";
export const CALCIUM_ID = "calcium";

export type ValenceElectronSampleId =
  | typeof HYDROGEN_ID
  | typeof HELIUM_ID
  | typeof SODIUM_ID
  | typeof MAGNESIUM_ID
  | typeof ALUMINUM_ID
  | typeof CHLORINE_ID
  | typeof ARGON_ID
  | typeof CALCIUM_ID;

export const VALENCE_ELECTRON_SAMPLE_IDS = [
  HYDROGEN_ID,
  HELIUM_ID,
  SODIUM_ID,
  MAGNESIUM_ID,
  ALUMINUM_ID,
  CHLORINE_ID,
  ARGON_ID,
  CALCIUM_ID,
] satisfies ValenceElectronSampleId[];

export const VALENCE_ELECTRON_SAMPLES = {
  [HYDROGEN_ID]: { atomicNumber: 1, symbol: "H" },
  [HELIUM_ID]: { atomicNumber: 2, symbol: "He" },
  [SODIUM_ID]: { atomicNumber: 11, symbol: "Na" },
  [MAGNESIUM_ID]: { atomicNumber: 12, symbol: "Mg" },
  [ALUMINUM_ID]: { atomicNumber: 13, symbol: "Al" },
  [CHLORINE_ID]: { atomicNumber: 17, symbol: "Cl" },
  [ARGON_ID]: { atomicNumber: 18, symbol: "Ar" },
  [CALCIUM_ID]: { atomicNumber: 20, symbol: "Ca" },
} satisfies Record<
  ValenceElectronSampleId,
  {
    atomicNumber: number;
    symbol: string;
  }
>;

export interface ValenceElectronSampleLabels {
  name: string;
  note: ReactNode;
  tab: string;
  tendency: ReactNode;
}

export interface ValenceElectronLabLabels {
  atomicNumber: string;
  behavior: string;
  chooseAtom: string;
  configuration: string;
  outerShell: string;
  samples: Record<ValenceElectronSampleId, ValenceElectronSampleLabels>;
  valenceElectron: string;
}

export interface ValenceElectronLabProps {
  description: ReactNode;
  labels: ValenceElectronLabLabels;
  title: ReactNode;
}

/**
 * Narrows ToggleGroup string values to the available valence-electron examples.
 */
export function isValenceElectronSampleId(
  value: string
): value is ValenceElectronSampleId {
  return VALENCE_ELECTRON_SAMPLE_IDS.some((sampleId) => sampleId === value);
}

/**
 * Reads the outer occupied shell and valence-electron count for a neutral atom up to calcium.
 */
export function getValenceElectronFacts(atomicNumber: number) {
  const shellConfiguration = getEarlyElementShellConfiguration(
    atomicNumber
  ).filter((shell) => shell.electronCount > 0);
  const outerShell = shellConfiguration.at(-1);

  if (!outerShell) {
    throw new Error("Valence electrons require at least one occupied shell.");
  }

  return {
    configurationMath: shellConfiguration
      .map((shell) => shell.electronCount)
      .join(", "),
    outerShell,
    shellConfiguration,
    valenceElectronCount: outerShell.electronCount,
  };
}
